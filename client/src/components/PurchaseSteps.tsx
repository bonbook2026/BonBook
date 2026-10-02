const steps = ['انتخاب کتاب', 'مرور سفارش', 'پرداخت'];

export function PurchaseSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="purchase-steps" aria-label="مراحل خرید">
      {steps.map((label, index) => (
        <li key={label} className={current === index + 1 ? 'is-active' : undefined} aria-current={current === index + 1 ? 'step' : undefined}>
          <span className="purchase-step-number">{(index + 1).toLocaleString('fa-IR')}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
