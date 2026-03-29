export const DRAFT_ORDER_CREATE_MUTATION = `
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        invoiceUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const DRAFT_ORDER_QUERY = `
  query draftOrder($id: ID!) {
    draftOrder(id: $id) {
      id
      status
    }
  }
`;
