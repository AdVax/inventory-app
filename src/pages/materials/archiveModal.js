/**
 * src/pages/materials/archiveModal.js
 */
import { archiveMaterial }     from '../../services/materials.service.js'
import { store }               from '../../store/store.js'
import { confirmArchive }      from '../../components/confirmDialog.js'
import { toast }               from '../../components/toast.js'

export function renderArchiveModal({ material, onSuccess }) {
  if (!material) return
  const user = store.getState('user')

  confirmArchive({
    itemName:   material.name,
    stockQty:   material.current_stock,
    unitSymbol: material.unit_symbol ?? '',
    onConfirm:  async (reason) => {
      const { error } = await archiveMaterial(material.id, reason, user.id)
      if (error) { toast.error(error); throw new Error(error) }
      onSuccess?.()
    },
  })
}
