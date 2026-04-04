export interface DraftOrderInput {
  lineItems: Array<{
    title: string;
    originalUnitPrice: string;
    quantity: number;
    customAttributes?: Array<{ key: string; value: string }>;
    requiresShipping?: boolean;
  }>;
  email?: string;
  note?: string;
  billingAddress?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    address1?: string;
    address2?: string;
    city?: string;
    zip?: string;
    countryCode?: string;
    company?: string;
  };
  shippingLine?: {
    title: string;
    price: string;
  };
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    address1?: string;
    address2?: string;
    city?: string;
    zip?: string;
    countryCode?: string;
    company?: string;
  };
}

export interface CustomAttribute {
  key: string;
  value: string;
}
