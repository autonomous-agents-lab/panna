import styles from "./write.module.css";

/**
 * A labelled title input. An error is shown under it, tied to the input by aria-describedby and
 * announced as it appears. No `required` or `maxLength`: the server checks the title and answers
 * with a translated error, the same with or without JavaScript.
 */
export function TitleField({
  id,
  label,
  defaultValue,
  error,
  autoFocus,
}: {
  id: string;
  label: string;
  defaultValue: string;
  error?: string;
  autoFocus?: boolean;
}) {
  const errorId = `${id}-error`;
  return (
    <span className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name="title"
        type="text"
        autoComplete="off"
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        autoFocus={autoFocus}
      />
      {error && (
        <span id={errorId} role="alert" className={styles.fieldError}>
          {error}
        </span>
      )}
    </span>
  );
}
