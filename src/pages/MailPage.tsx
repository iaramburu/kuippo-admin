import { useState } from 'react';
import { Button, errorText, Field, inputClass, Notice, Origin, Page, Panel, useAction } from '../components/ui';
import { parametersOf, useParameters, useParameterWrites } from '../lib/queries';
import type { MailText, Parameter } from '../lib/types';

/** The e-mail with the variables filled with a sample, only to see how it reads (the real one is built by the server). */
function sample(html: string): string {
  return html.replace(/\{\{\s*\.(\w+)\s*\}\}/g, (_, name: string) => (name === 'Name' ? 'Ana' : name === 'ExpiresMinutes' ? '60' : name === 'URL' ? '#' : 'ejemplo'));
}

function Template({ parameter }: { parameter: Parameter }) {
  const stored = parameter.value as MailText;
  const [text, setText] = useState<MailText>(stored);
  const [showPreview, setShowPreview] = useState(false);
  const { save, reset } = useParameterWrites();
  const action = useAction();
  const changed = JSON.stringify(text) !== JSON.stringify(stored);
  const empty = !text.subject.trim() || !text.html.trim() || !text.text.trim();

  return (
    <Panel title={parameter.title} subtitle={parameter.description} actions={<Origin parameter={parameter} />}>
      <div className="space-y-3">
        <Field label="Asunto" htmlFor={`${parameter.key}-subject`}>
          <input id={`${parameter.key}-subject`} className={inputClass} value={text.subject} onChange={(e) => setText({ ...text, subject: e.target.value })} />
        </Field>
        <Field label="Cuerpo en HTML" htmlFor={`${parameter.key}-html`} hint="Va dentro del marco de Kuippo (cabecera y pie), que no se cambia aquí.">
          <textarea id={`${parameter.key}-html`} rows={8} className={`${inputClass} font-mono`} value={text.html} onChange={(e) => setText({ ...text, html: e.target.value })} />
        </Field>
        <Field label="Texto sin formato" htmlFor={`${parameter.key}-text`} hint="Lo que ven los programas de correo que no muestran HTML.">
          <textarea id={`${parameter.key}-text`} rows={8} className={`${inputClass} font-mono`} value={text.text} onChange={(e) => setText({ ...text, text: e.target.value })} />
        </Field>
      </div>
      {showPreview && (
        <iframe title={`Vista previa: ${parameter.title}`} sandbox="" srcDoc={sample(text.html)} className="mt-3 h-64 w-full rounded-lg border border-slate-300 bg-white" />
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          disabled={!changed || empty || action.busy}
          onClick={() => void action.run(() => save(parameter.scope, parameter.key, text), 'Guardado. Los próximos correos usan este texto.')}
        >
          Guardar
        </Button>
        <Button variant="secondary" onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? 'Ocultar la vista previa' : 'Vista previa'}
        </Button>
        <Button variant="secondary" disabled={!parameter.overridden || action.busy} onClick={() => void action.run(() => reset(parameter.scope, parameter.key), 'Restaurado el texto por defecto.')}>
          Restaurar el texto por defecto
        </Button>
        <Notice message={action.message} />
      </div>
    </Panel>
  );
}

export function MailPage() {
  const { data, error, isPending } = useParameters();
  return (
    <Page
      title="Plantillas de correo"
      intro="Los textos de los correos que envía Kuippo. Se comprueban antes de guardar: un texto que usara una variable que el correo no tiene, o que estuviera mal escrito, no se guarda."
    >
      {isPending && <p className="text-sm text-slate-500">Cargando…</p>}
      {error && <Notice message={{ kind: 'error', text: errorText(error) }} />}
      {parametersOf(data, 'mail').map((p) => (
        <Template key={`${p.key}-${JSON.stringify(p.value)}`} parameter={p} />
      ))}
    </Page>
  );
}
