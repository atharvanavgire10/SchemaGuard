const demoData = {
  api: {
    name: "E-Commerce API",
    version: "v1",
    endpoints: 24,
    productionRequests: 184291
  },

  contracts: {
    "/users/:id": {
      id: "integer",
      name: "string",
      email: "string",
      avatar: "string|null",
      status: "enum"
    }
  },

  traffic: {
    "/users/:id": {
      totalRequests: 184291,
      clients: {
        web: 42.1,
        android: 34.8,
        ios: 23.1
      }
    }
  },

  scenarios: [
    {
      id: "add-avatar",
      name: "Add optional avatar",
      type: "safe"
    },
    {
      id: "change-status",
      name: "Change status values",
      type: "risky"
    },
    {
      id: "remove-email",
      name: "Remove email field",
      type: "breaking"
    },
    {
      id: "change-id",
      name: "Change id from integer to string",
      type: "breaking"
    }
  ]
};

module.exports = demoData;