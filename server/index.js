index.js-
// import packages
const express = require("express");
const morgan = require("morgan");
const path = require("path");
const {
  client,
  createTables,
  seeProducts,
  seeProduct,
  createUser,
  createCart,
  seeCart,
  createCartProduct,
  seeCartProducts,
  addProductToCart,
  deleteProductFromCart,
  changeQuantity,
  updateUser,
  deleteUser,
  seeUsers,
  createProduct,
  updateProduct,
  deleteProduct,
  authenticate,
  findUserWithToken,
} = require("./db");

const app = express();

// Middleware
app.use(express.json());
app.use(morgan("dev"));
app.get("/", (req, res) =>
  res.send("Server is running and listening on port 3000")
);


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).send({ error: err.message });
});

// Custom middleware for checking if user is logged in
const isLoggedIn = async (req, res, next) => {
  try {
    req.user = await findUserWithToken(req.headers.authorization);
    next();
  } catch (ex) {
    next(ex);
  }
};

// Custom middleware for checking if user is admin
const isAdmin = async (req, res, next) => {
  if (!req.user.is_admin) {
    res.status(403).send("Not authorized");
  } else {
    next();
  }
};

// User NOT logged in

// login not required to see available products
app.get("/api/products", async (req, res, next) => {
  try {
    res.send(await seeProducts());
  } catch (ex) {
    next(ex);
  }
});

app.get("/api/products/:productId", async (req, res, next) => {
  try {
    res.send(await seeProduct(req.params.productId));
  } catch (ex) {
    next(ex);
  }
});

// create an account
app.post("/api/auth/register", async (req, res, next) => {
  try {
    res.send(await createUser(req.body));
  } catch (ex) {
    next(ex);
  }
});

// login to account
app.post("/api/auth/login", async (req, res, next) => {
  try {
    res.send(await authenticate(req.body));
  } catch (ex) {
    next(ex);
  }
});

// LOGGED IN USER
//  functions - add product to cart, see cart, edit cart, purchase

// user account
app.get("/api/auth/me", isLoggedIn, (req, res, next) => {
  try {
    res.send(req.user);
  } catch (ex) {
    next(ex);
  }
});

// login in user to see cart details
app.get("/api/users/:id/cart", isLoggedIn, async (req, res, next) => {
  try {
    if (req.params.id !== req.user.id) {
      const error = Error("not authorized");
      error.status = 401;
      throw error;
    }
    res.send(await seeCart(req.params.id));
  } catch (ex) {
    next(ex);
  }
});

// login user to see cart products
app.get(
  "/api/users/:id/cart/cartProducts",
  isLoggedIn,
  async (req, res, next) => {
    try {
      if (req.params.id !== req.user.id) {
        const error = Error("not authorized");
        error.status = 401;
        throw error;
      }
      const cartId = await seeCart(req.params.id);
      const cartProducts = await seeCartProducts(cartId.id);
      res.status(201).send(cartProducts);
    } catch (ex) {
      next(ex);
    }
  }
);

// login user to add product to cart
app.post(
  "/api/users/:id/cart/cartProducts",
  isLoggedIn,
  async (req, res, next) => {
    try {
      if (req.params.id !== req.user.id) {
        const error = Error("not authorized");
        error.status = 401;
        throw error;
      }
      const cartId = await seeCart(req.params.id);
      res.send(
        await addProductToCart({
          cart_id: cartId.id,
          product_id: req.body.product_id,
          quantity: req.body.quantity,
        })
      );
    } catch (ex) {
      next(ex);
    }
  }
);

// login user to change quantity of product in cart
app.put(
  "/api/users/:id/cart/cartProducts/:cartProductId",
  isLoggedIn,
  async (req, res, next) => {
    try {
      if (req.params.id !== req.user.id) {
        const error = Error("not authorized");
        error.status = 401;
        throw error;
      }
      const cartId = await seeCart(req.params.id);
      res.send(
        await changeQuantity({
          cart_id: cartId.id,
          product_id: req.params.cartProductId,
          quantity: req.body.quantity,
        })
      );
    } catch (ex) {
      next(ex);
    }
  }
);

// login user to delete product from cart
app.delete(
  "/api/users/:id/cart/cartProducts/:cartProductId",
  isLoggedIn,
  async (req, res, next) => {
    try {
      if (req.params.user_id !== req.user.id) {
        const error = Error("not authorized");
        error.status = 401;
        throw error;
      }
      const cartId = await seeCart(req.params.id);
      await deleteProductFromCart({
        cart_id: cartId.id,
        product_id: req.params.cartProductId,
      });
      res.sendStatus(204);
    } catch (ex) {
      next(ex);
    }
  }
);

// login user to purchase products

//  login user to update information about user
app.put("/api/users/:id", isLoggedIn, async (req, res, next) => {
  try {
    if (req.params.id !== req.user.id) {
      const error = Error("not authorized");
      error.status = 401;
      throw error;
    }
    res.status(201).send(
      await updateUser({
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phone_number: req.body.phone_number,
        id: req.params.id,
      })
    );
  } catch (ex) {
    next(ex);
  }
});

// login user to delete an account
app.delete("/api/users/:id", isLoggedIn, async (req, res, next) => {
  try {
    if (req.params.id !== req.user.id) {
      const error = Error("not authorized");
      error.status = 401;
      throw error;
    }
    await deleteUser(req.params.id);
    res.sendStatus(204);
  } catch (ex) {
    next(ex);
  }
});

// ADMIN FUNCTIONS
// admin to see all products
app.get(
  "/api/users/:id/products",
  isLoggedIn,
  isAdmin,
  async (req, res, next) => {
    try {
      if (req.params.id !== req.user.id) {
        const error = Error("not authorized");
        error.status = 401;
        throw error;
      }
      res.send(await seeProducts());
    } catch (ex) {
      next(ex);
    }
  }
);

// admin to add a product
app.post(
  "/api/users/:id/products",
  isLoggedIn,
  isAdmin,
  async (req, res, next) => {
    try {
      if (req.params.id !== req.user.id) {
        const error = Error("not authorized");
        error.status = 401;
        throw error;
      }
      res.status(201).send(
        await createProduct({
          name: req.body.name,
          price: req.body.price,
          description: req.body.description,
          inventory: req.body.inventory,
        })
      );
    } catch (ex) {
      next(ex);
    }
  }
);

// admin to edit a product
app.put(
  "/api/users/:id/products/:productId",
  isLoggedIn,
  isAdmin,
  async (req, res, next) => {
    try {
      if (req.params.id !== req.user.id) {
        const error = Error("not authorized");
        error.status = 401;
        throw error;
      }
      res.status(201).send(
        await updateProduct({
          id: req.params.productId,
          name: req.body.name,
          price: req.body.price,
          description: req.body.description,
          inventory: req.body.inventory,
        })
      );
    } catch (ex) {
      next(ex);
    }
  }
);

// admin to delete a product
app.delete(
  "/api/users/:id/products/:productId",
  isLoggedIn,
  isAdmin,
  async (req, res, next) => {
    try {
      if (req.params.id !== req.user.id) {
        const error = Error("not authorized");
        error.status = 401;
        throw error;
      }
      await deleteProduct(req.params.productId);
      res.sendStatus(204);
    } catch (ex) {
      next(ex);
    }
  }
);

// admin see all users
app.get("/api/users/:id/users", isLoggedIn, isAdmin, async (req, res, next) => {
  try {
    if (req.params.id !== req.user.id) {
      const error = Error("not authorized");
      error.status = 401;
      throw error;
    }
    res.send(await seeUsers());
  } catch (ex) {
    next(ex);
  }
});

const init = async () => {
  await client.connect();
  console.log("connected to database");
  await createTables();
  console.log("tables created");
  const [cameron, emily, sarah, cattoy, catfood, dogfood, dogcollar] =
    await Promise.all([
      createUser({
        email: "cameron@icloud.com",
        password: "meow",
        is_admin: true,
      }),
      createUser({
        email: "emily@icloud.com",
        password: "woofwoof",
      }),
      createUser({
        email: "sarah@icloud.com",
        password: "kittylover",
      }),

      createProduct({
        name: "cat toy",
        price: 1.99,
        description: "ball cat toy",
        inventory: 10,
      }),
      createProduct({
        name: "cat food",
        price: 32.99,
        description: "best cat food ever",
        inventory: 15,
      }),
      createProduct({
        name: "dog food",
        price: 54.98,
        description: "ultimate dog food",
        inventory: 20,
      }),
      createProduct({
        name: "dog collar",
        price: 19.95,
        description: "premium dog collar",
        inventory: 25,
      }),
    ]);
  const users = await seeUsers();
  console.log("Users: ", users);
  const products = await seeProducts();
  console.log("Products: ", products);
  const carts = await Promise.all([
    createCart({ user_id: cameron.id }),
    createCart({ user_id: emily.id }),
    createCart({ user_id: sarah.id }),
  ]);
  console.log("Carts: ", carts);

  const productsInCart = await Promise.all([
    createCartProduct({
      cart_id: carts[0].id,
      product_id: cattoy.id,
      quantity: 3,
    }),
    createCartProduct({
      cart_id: carts[0].id,
      product_id: catfood.id,
      quantity: 2,
    }),
    createCartProduct({
      cart_id: carts[1].id,
      product_id: dogfood.id,
      quantity: 1,
    }),
    createCartProduct({
      cart_id: carts[1].id,
      product_id: dogcollar.id,
      quantity: 5,
    }),
    createCartProduct({
      cart_id: carts[1].id,
      product_id: cattoy.id,
      quantity: 4,
    }),
    createCartProduct({
      cart_id: carts[2].id,
      product_id: catfood.id,
      quantity: 1,
    }),
  ]);

  console.log(productsInCart);

  // Start server
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`listening on port ${port}`));
};

init(); // Call the init function to start the initialization process