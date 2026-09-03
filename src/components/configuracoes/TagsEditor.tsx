"use client";

import { createTagAction, deleteTagAction, updateTagAction } from "@/app/actions/tags";
import { ReferenceListEditor, type ReferenceItem } from "./ReferenceListEditor";

export function TagsEditor({ items }: { items: ReferenceItem[] }) {
  return (
    <ReferenceListEditor
      items={items}
      emptyMessage="Nenhuma tag cadastrada ainda."
      addPlaceholder="Nome da tag"
      deleteConfirmLabel={(name) =>
        `Excluir a tag "${name}"? Lançamentos que a utilizam ficarão sem tag.`
      }
      onCreate={createTagAction}
      onUpdate={updateTagAction}
      onDelete={deleteTagAction}
    />
  );
}
