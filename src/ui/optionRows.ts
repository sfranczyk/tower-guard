/** The rules pages' rows (battle setup, MOBA room): an icon, a name with a hint, and the control on the right. */

/** A number field with its limits. */
export const numberInput = (attribute: string, value: number, limits: { min: number; max: number; step: number }): string =>
  `<input type="number" ${attribute} value="${value}" min="${limits.min}" max="${limits.max}" step="${limits.step}">`;

/** One rule per row. Only a number field's row is a <label>: a label round the chips would press the first one on any click in the row. */
export const optionRow = (label: string, hint: string, control: string, icon: string): string => {
  const tag = control.startsWith('<input') ? 'label' : 'div';
  return `<${tag} class="option-row">${icon}<span><strong>${label}</strong><small>${hint}</small></span>${control}</${tag}>`;
};
