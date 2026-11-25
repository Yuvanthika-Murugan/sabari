import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { useData } from '@/context/DataContext';
import { useToast } from '@/context/ToastContext';

type Values = Record<string, string>;

/**
 * Form state + API submission. `field(name)` returns the props for an
 * Input/Select/TextArea, including the server-side validation error.
 */
export function useForm<T extends Values>(initial: T) {
  const { refresh } = useData();
  const toast = useToast();
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (name: keyof T & string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }));
    setErrors(prev => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const field = (name: keyof T & string) => ({
    value: values[name],
    onChange: (v: string) => set(name, v),
    error: errors[name],
  });

  const reset = (next: T = initial) => {
    setValues(next);
    setErrors({});
  };

  /** Runs the request, refreshes app data, and reports the outcome. Resolves true on success. */
  const submit = async <R,>(request: (values: T) => Promise<R>, successMessage: string | ((result: R) => string)) => {
    setSubmitting(true);
    try {
      const result = await request(values);
      await refresh();
      toast('success', typeof successMessage === 'function' ? successMessage(result) : successMessage);
      return true;
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.errors);
      toast('error', e instanceof Error ? e.message : 'Something went wrong');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return { values, set, field, reset, submit, submitting, errors };
}

/** For one-off actions (delete, approve, mark read) that need no form. */
export function useAction() {
  const { refresh } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (request: () => Promise<unknown>, successMessage?: string) => {
    setBusy(true);
    try {
      await request();
      await refresh();
      if (successMessage) toast('success', successMessage);
      return true;
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Something went wrong');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { run, busy };
}
