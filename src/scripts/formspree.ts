// Shared Formspree submit handler.
//
// Both the homepage hero form and the contact page post to the same Formspree
// endpoint, so the fetch/success/error dance lives here once rather than being
// pasted into each page. Progressive enhancement: the <form> keeps its real
// action + method attributes, so if this script never runs the browser just
// submits it normally and Formspree renders its own thank-you page.

type FormRefs = {
  form: string;
  submit: string;
  success: string;
  error: string;
  /** Restored on the button after a failed attempt. */
  submitLabel: string;
};

const FALLBACK_EMAIL = 'promostrats@gmail.com';

export function wireFormspreeForm(refs: FormRefs) {
  const form = document.getElementById(refs.form) as HTMLFormElement | null;
  const submit = document.getElementById(refs.submit) as HTMLButtonElement | null;
  const success = document.getElementById(refs.success);
  const error = document.getElementById(refs.error);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!submit) return;

    error?.setAttribute('hidden', '');
    submit.disabled = true;
    submit.textContent = 'Sending...';

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) throw new Error('Submission failed');

      form.setAttribute('hidden', '');
      success?.removeAttribute('hidden');
    } catch {
      if (error) {
        error.textContent = `✗ Something went wrong. Email me directly at ${FALLBACK_EMAIL} and I'll pick it up.`;
        error.removeAttribute('hidden');
      }
      submit.disabled = false;
      submit.textContent = refs.submitLabel;
    }
  });
}
