'use strict';

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

  // Base observed production schema for GET /users/:id
  baseSchema: {
    type: "object",
    properties: {
      id: { type: "integer" },
      name: { type: "string" },
      email: { type: "string" },
      avatar: { type: ["string", "null"] },
      status: { type: "string", enum: ["active", "inactive"] },
      customer: {
        type: "object",
        properties: {
          address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
              zipCode: { type: "string" }
            }
          }
        }
      }
    }
  },

  scenarios: [
    {
      id: "add-avatar",
      name: "Add optional avatar field",
      description: "A new optional avatar URL field is added to the user response.",
      endpoint: "GET /users/:id",
      afterSchema: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          email: { type: "string" },
          avatar: { type: ["string", "null"] },
          status: { type: "string", enum: ["active", "inactive"] },
          avatarUrl: { type: ["string", "null"] },
          customer: {
            type: "object",
            properties: {
              address: {
                type: "object",
                properties: {
                  street: { type: "string" },
                  city: { type: "string" },
                  zipCode: { type: "string" }
                }
              }
            }
          }
        }
      }
    },
    {
      id: "add-metadata",
      name: "Add optional metadata object",
      description: "A new optional metadata object is appended to the response.",
      endpoint: "GET /users/:id",
      afterSchema: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          email: { type: "string" },
          avatar: { type: ["string", "null"] },
          status: { type: "string", enum: ["active", "inactive"] },
          metadata: {
            type: ["object", "null"],
            properties: {
              createdAt: { type: "string" },
              updatedAt: { type: "string" }
            }
          },
          customer: {
            type: "object",
            properties: {
              address: {
                type: "object",
                properties: {
                  street: { type: "string" },
                  city: { type: "string" },
                  zipCode: { type: "string" }
                }
              }
            }
          }
        }
      }
    },
    {
      id: "add-status-enum",
      name: "Add new status enum value",
      description: "A new status value 'suspended' is added to the enum.",
      endpoint: "GET /users/:id",
      afterSchema: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          email: { type: "string" },
          avatar: { type: ["string", "null"] },
          status: { type: "string", enum: ["active", "inactive", "suspended"] },
          customer: {
            type: "object",
            properties: {
              address: {
                type: "object",
                properties: {
                  street: { type: "string" },
                  city: { type: "string" },
                  zipCode: { type: "string" }
                }
              }
            }
          }
        }
      }
    },
    {
      id: "change-format",
      name: "Change a field format",
      description: "The 'name' field changes from string to an object with first/last.",
      endpoint: "GET /users/:id",
      afterSchema: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: {
            type: "object",
            properties: {
              first: { type: "string" },
              last: { type: "string" }
            }
          },
          email: { type: "string" },
          avatar: { type: ["string", "null"] },
          status: { type: "string", enum: ["active", "inactive"] },
          customer: {
            type: "object",
            properties: {
              address: {
                type: "object",
                properties: {
                  street: { type: "string" },
                  city: { type: "string" },
                  zipCode: { type: "string" }
                }
              }
            }
          }
        }
      }
    },
    {
      id: "remove-email",
      name: "Remove email field",
      description: "The email field is removed from the user response.",
      endpoint: "GET /users/:id",
      afterSchema: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          avatar: { type: ["string", "null"] },
          status: { type: "string", enum: ["active", "inactive"] },
          customer: {
            type: "object",
            properties: {
              address: {
                type: "object",
                properties: {
                  street: { type: "string" },
                  city: { type: "string" },
                  zipCode: { type: "string" }
                }
              }
            }
          }
        }
      }
    },
    {
      id: "change-id",
      name: "Change id integer to string",
      description: "The id field type changes from integer to string.",
      endpoint: "GET /users/:id",
      afterSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string" },
          avatar: { type: ["string", "null"] },
          status: { type: "string", enum: ["active", "inactive"] },
          customer: {
            type: "object",
            properties: {
              address: {
                type: "object",
                properties: {
                  street: { type: "string" },
                  city: { type: "string" },
                  zipCode: { type: "string" }
                }
              }
            }
          }
        }
      }
    },
    {
      id: "remove-zipcode",
      name: "Remove nested zipCode field",
      description: "The nested customer.address.zipCode field is removed.",
      endpoint: "GET /users/:id",
      afterSchema: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          email: { type: "string" },
          avatar: { type: ["string", "null"] },
          status: { type: "string", enum: ["active", "inactive"] },
          customer: {
            type: "object",
            properties: {
              address: {
                type: "object",
                properties: {
                  street: { type: "string" },
                  city: { type: "string" }
                }
              }
            }
          }
        }
      }
    },
    {
      id: "make-non-nullable",
      name: "Make nullable field non-nullable",
      description: "The avatar field changes from nullable to required non-null.",
      endpoint: "GET /users/:id",
      afterSchema: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          email: { type: "string" },
          avatar: { type: "string" },
          status: { type: "string", enum: ["active", "inactive"] },
          customer: {
            type: "object",
            properties: {
              address: {
                type: "object",
                properties: {
                  street: { type: "string" },
                  city: { type: "string" },
                  zipCode: { type: "string" }
                }
              }
            }
          }
        }
      }
    }
  ]
};

module.exports = demoData;