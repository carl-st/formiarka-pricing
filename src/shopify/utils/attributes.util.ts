import { CustomAttribute } from "../interfaces/draft-order.interface";

export const addAttribute = (
  customAttributes: CustomAttribute[],
  key: string | undefined,
  value: any,
): void => {
  if (value !== null && value !== undefined && value !== "" && key) {
    customAttributes.push({ key, value: String(value) });
  }
};
