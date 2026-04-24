/**
 * src/store/store.js
 * ──────────────────────────────────────────────────────────────
 * 🧠 إدارة الحالة المركزية — بديل Zustand بالـ Vanilla JS
 *
 * المبدأ:
 *   كائن واحد يحمل كل حالة التطبيق.
 *   عند تغيير أي قيمة، يُطلق "Custom Event" على الـ document
 *   تستمع إليه المكونات التي تهتم بهذا التغيير وتُحدّث نفسها.
 *
 * هذا يحاكي نمط Zustand / Redux بدون أي مكتبة خارجية:
 *
 *   Zustand:   useStore(state => state.user)      → subscribe تلقائي
 *   هنا:       document.on('store:user', handler) → نفس النتيجة
 *
 * ──────────────────────────────────────────────────────────────
 * 🔐 ملاحظات أمنية:
 *
 * - الـ store في الذاكرة فقط — لا يُكتب في localStorage إلا
 *   البيانات غير الحساسة (اسم المستخدم، الدور، الإعدادات).
 *
 * - الجلسة الحقيقية محفوظة بواسطة Supabase في localStorage
 *   بشكل مشفر — لا نلمسها يدوياً.
 *
 * - الـ user.role في الـ store للـ UI فقط (إخفاء أزرار).
 *   القرار الأمني الفعلي يأتي من RLS في الـ Database.
 * ──────────────────────────────────────────────────────────────
 */

// ══════════════════════════════════════════════════════════════
// 📦 الحالة الأولية — Initial State
// ══════════════════════════════════════════════════════════════
const INITIAL_STATE = {

  // ─── المستخدم الحالي ─────────────────────────────────────
  user: null,
  /*
   * شكل الكائن عند تسجيل الدخول:
   * {
   *   id:         'uuid',
   *   full_name:  'محمد أحمد',
   *   role:       'admin' | 'viewer',
   *   is_active:  true,
   *   created_at: '...',
   *   updated_at: '...',
   * }
   */

  // ─── حالة التحميل ────────────────────────────────────────
  isAuthLoading: true,   // true أثناء التحقق من الجلسة عند البدء
  isAppReady:    false,  // true بعد اكتمال كل التهيئة

  // ─── إعدادات الشركة ──────────────────────────────────────
  companySettings: null,
  /*
   * {
   *   id:               1,
   *   company_name:     'شركتي',
   *   phone:            '...',
   *   address:          '...',
   *   currency_local:   'SYP',
   *   currency_foreign: 'USD',
   *   fiscal_year_start: '...',
   *   updated_at:       '...',
   * }
   */

  // ─── سعر الصرف ───────────────────────────────────────────
  latestExchangeRate: null,
  /*
   * {
   *   id:         'uuid',
   *   rate_date:  '2024-01-01',
   *   usd_to_syp: 14000,
   *   notes:      '...',
   *   created_at: '...',
   * }
   */

  // ─── الصفحة الحالية ──────────────────────────────────────
  currentPage: 'dashboard',  // dashboard | materials | transactions | reports | settings | login

  // ─── الـ Sidebar ──────────────────────────────────────────
  sidebarOpen: false,

  // ─── المواد (Cache محلي) ──────────────────────────────────
  // نخزن آخر جلب للأداء — يُحدَّث عند كل تغيير
  materialsCache: null,     // null = لم يُجلب بعد
  materialsCacheTime: 0,    // timestamp آخر جلب
  CACHE_TTL: 3 * 60 * 1000, // 3 دقائق

  // ─── الوحدات (Cache محلي) ────────────────────────────────
  unitsCache: null,
  unitsCacheTime: 0,
}

// ══════════════════════════════════════════════════════════════
// 🏗️ Store Factory — المصنع الرئيسي
// ══════════════════════════════════════════════════════════════
function createStore(initialState) {

  // الحالة الداخلية — مخفية خارج هذه الدالة
  let state = { ...initialState }

  // تاريخ التغييرات (للـ debugging فقط)
  const changeLog = []

  // ─── setState — تحديث الحالة ─────────────────────────────
  /**
   * تحديث جزء من الحالة وإطلاق الأحداث المناسبة
   *
   * @param {Partial<typeof INITIAL_STATE>} updates - التحديثات
   * @param {boolean} [silent=false] - إذا true، لا يُطلق أحداث
   */
  function setState(updates, silent = false) {
    if (!updates || typeof updates !== 'object') return

    const changedKeys = []

    for (const [key, newValue] of Object.entries(updates)) {
      // تجاهل التحديثات التي لا تغير القيمة
      if (state[key] === newValue) continue

      const oldValue = state[key]
      state[key] = newValue
      changedKeys.push(key)

      // تسجيل التغيير (في وضع التطوير)
      if (window.location.hostname === 'localhost') {
        changeLog.push({
          key,
          oldValue,
          newValue,
          time: new Date().toISOString(),
        })
        // نحافظ على آخر 50 تغيير فقط
        if (changeLog.length > 50) changeLog.shift()
      }
    }

    if (!silent && changedKeys.length > 0) {
      // إطلاق حدث لكل مفتاح تغيّر
      changedKeys.forEach(key => {
        document.dispatchEvent(new CustomEvent(`store:${key}`, {
          detail: { value: state[key], state },
          bubbles: false,
        }))
      })

      // حدث عام لأي تغيير
      document.dispatchEvent(new CustomEvent('store:change', {
        detail: { keys: changedKeys, state },
        bubbles: false,
      }))
    }
  }

  // ─── getState — قراءة الحالة ─────────────────────────────
  /**
   * قراءة الحالة الكاملة أو مفتاح محدد
   *
   * @param {string} [key] - المفتاح المطلوب (اختياري)
   * @returns {any}
   */
  function getState(key) {
    if (key) return state[key]
    // نُعيد نسخة لمنع التعديل المباشر
    return { ...state }
  }

  // ─── subscribe — الاستماع للتغييرات ──────────────────────
  /**
   * الاشتراك في تغييرات مفتاح معين
   *
   * @param {string|string[]} keys - المفتاح أو مصفوفة مفاتيح
   * @param {Function} handler - دالة تُستدعى عند التغيير
   * @returns {Function} دالة لإلغاء الاشتراك (Cleanup)
   *
   * مثال:
   *   const unsub = store.subscribe('user', ({ value }) => {
   *     console.log('User changed:', value)
   *   })
   *   // لإلغاء الاشتراك لاحقاً:
   *   unsub()
   */
  function subscribe(keys, handler) {
    const keyList = Array.isArray(keys) ? keys : [keys]
    const listeners = []

    keyList.forEach(key => {
      const wrappedHandler = (event) => handler(event.detail)
      document.addEventListener(`store:${key}`, wrappedHandler)
      listeners.push({ key, wrappedHandler })
    })

    // إعادة دالة إلغاء الاشتراك
    return function unsubscribe() {
      listeners.forEach(({ key, wrappedHandler }) => {
        document.removeEventListener(`store:${key}`, wrappedHandler)
      })
    }
  }

  // ─── reset — إعادة ضبط الحالة ────────────────────────────
  /**
   * إعادة ضبط الحالة الكاملة أو مفاتيح محددة
   * يُستخدم عند تسجيل الخروج
   *
   * @param {string[]} [keys] - المفاتيح المراد إعادة ضبطها (كل شيء إذا فارغ)
   */
  function reset(keys = null) {
    if (keys) {
      const updates = {}
      keys.forEach(key => {
        if (key in INITIAL_STATE) {
          updates[key] = INITIAL_STATE[key]
        }
      })
      setState(updates)
    } else {
      setState({ ...INITIAL_STATE })
    }
  }

  // ─── للـ Debugging في Console ─────────────────────────────
  if (window.location.hostname === 'localhost') {
    window.__store = {
      getState,
      changeLog: () => changeLog,
      help: () => console.table(Object.keys(state).map(k => ({
        key: k,
        type: typeof state[k],
        value: typeof state[k] === 'object' ? '[object]' : state[k],
      }))),
    }
    console.info('🔧 Store Debug: window.__store.getState() | window.__store.help()')
  }

  return { setState, getState, subscribe, reset }
}

// ══════════════════════════════════════════════════════════════
// 🚀 إنشاء الـ Store وتصديره
// ══════════════════════════════════════════════════════════════
export const store = createStore(INITIAL_STATE)

// ══════════════════════════════════════════════════════════════
// 🎯 Action Creators — دوال منطقية جاهزة
// هذه الدوال تجمع منطق تحديث الـ store في مكان واحد
// ══════════════════════════════════════════════════════════════

// ─── Auth Actions ─────────────────────────────────────────────

/**
 * تعيين المستخدم بعد تسجيل الدخول
 * @param {object} userProfile - بيانات المستخدم من profiles table
 */
export function setUser(userProfile) {
  store.setState({
    user:          userProfile,
    isAuthLoading: false,
    isAppReady:    true,
  })
}

/**
 * تسجيل الخروج — مسح كل البيانات الحساسة
 */
export function clearUser() {
  store.setState({
    user:               null,
    isAuthLoading:      false,
    isAppReady:         true,
    companySettings:    null,
    latestExchangeRate: null,
    materialsCache:     null,
    unitsCache:         null,
    currentPage:        'login',
  })
}

/**
 * تعيين حالة تحميل المصادقة
 * @param {boolean} loading
 */
export function setAuthLoading(loading) {
  store.setState({ isAuthLoading: loading })
}

// ─── Settings Actions ─────────────────────────────────────────

/**
 * تحديث إعدادات الشركة
 * @param {object} settings
 */
export function setCompanySettings(settings) {
  store.setState({ companySettings: settings })
}

/**
 * تحديث سعر الصرف
 * @param {object} rateObj - كائن سعر الصرف كامل
 */
export function setLatestExchangeRate(rateObj) {
  store.setState({ latestExchangeRate: rateObj })
}

// ─── Navigation Actions ───────────────────────────────────────

/**
 * تغيير الصفحة الحالية
 * @param {string} page
 */
export function setCurrentPage(page) {
  store.setState({ currentPage: page })
}

/**
 * فتح/إغلاق الـ Sidebar
 * @param {boolean} [isOpen] - إذا لم يُحدد، يعكس الحالة الحالية
 */
export function toggleSidebar(isOpen) {
  const current = store.getState('sidebarOpen')
  store.setState({
    sidebarOpen: isOpen !== undefined ? isOpen : !current,
  })
}

// ─── Cache Actions ────────────────────────────────────────────

/**
 * تحديث Cache المواد
 * @param {object[]} materials
 */
export function setMaterialsCache(materials) {
  store.setState({
    materialsCache:    materials,
    materialsCacheTime: Date.now(),
  })
}

/**
 * التحقق من أن Cache المواد لا يزال صالحاً
 * @returns {boolean}
 */
export function isMaterialsCacheValid() {
  const { materialsCache, materialsCacheTime, CACHE_TTL } = store.getState()
  return (
    materialsCache !== null &&
    Date.now() - materialsCacheTime < CACHE_TTL
  )
}

/**
 * إبطال Cache المواد (عند إضافة/تعديل/أرشفة مادة)
 */
export function invalidateMaterialsCache() {
  store.setState({
    materialsCache:    null,
    materialsCacheTime: 0,
  })
}

/**
 * تحديث Cache الوحدات
 * @param {object[]} units
 */
export function setUnitsCache(units) {
  store.setState({
    unitsCache:    units,
    unitsCacheTime: Date.now(),
  })
}

/**
 * التحقق من أن Cache الوحدات لا يزال صالحاً
 * @returns {boolean}
 */
export function isUnitsCacheValid() {
  const { unitsCache, unitsCacheTime, CACHE_TTL } = store.getState()
  return (
    unitsCache !== null &&
    Date.now() - unitsCacheTime < CACHE_TTL
  )
}

// ── Computed / Selectors — استخلاص بيانات محسوبة ───────────────

/**
 * هل المستخدم الحالي admin؟
 * @returns {boolean}
 */
export function selectIsAdmin() {
  const user = store.getState('user')
  return user?.role === 'admin' && user?.is_active === true
}

/**
 * هل المستخدم الحالي viewer؟
 * @returns {boolean}
 */
export function selectIsViewer() {
  const user = store.getState('user')
  return user?.role === 'viewer' && user?.is_active === true
}

/**
 * الحصول على سعر الصرف الحالي كرقم
 * @returns {number} 0 إذا لم يُضبط بعد
 */
export function selectExchangeRate() {
  return store.getState('latestExchangeRate')?.usd_to_syp ?? 0
}

/**
 * الحصول على اسم الشركة
 * @returns {string}
 */
export function selectCompanyName() {
  return store.getState('companySettings')?.company_name ?? 'نظام إدارة المخزون'
}
