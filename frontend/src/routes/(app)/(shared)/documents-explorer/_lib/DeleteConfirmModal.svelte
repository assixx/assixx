<script lang="ts">
  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import type { Document } from './types';

  interface Props {
    show: boolean;
    document: Document | null;
    submitting: boolean;
    onclose: () => void;
    onconfirm: () => void;
  }

  const { show, document, submitting, onclose, onconfirm }: Props = $props();
</script>

<ConfirmModal
  show={show && document !== null}
  id="document-delete-modal"
  title="Dokument löschen?"
  {submitting}
  {onconfirm}
  oncancel={onclose}
>
  <strong>ACHTUNG:</strong> Diese Aktion kann nicht rückgängig gemacht werden!
  <br /><br />
  Das Dokument <strong>"{document?.filename}"</strong> wird unwiderruflich gelöscht.
</ConfirmModal>
