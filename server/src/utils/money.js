export function rupeesToPaise(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('Amount must be a positive number');
  }
  const text = value.toFixed(2);
  const [whole, fraction] = text.split('.');
  return BigInt(whole) * 100n + BigInt(fraction);
}

export function paiseToRupees(value) {
  return (Number(value) / 100).toFixed(2);
}
