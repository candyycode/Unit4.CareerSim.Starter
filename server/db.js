// imports
const pg = require("pg");
const client = new pg.Client(
  process.env.DATABASE_URL || "postgres://localhost/my_store_db"
);
const uuid = require("uuid");
const bcrypt = require('bcrypt');
// install the jsonwebtoken library & secret
const jwt = require('jsonwebtoken');
const JWT = process.env.JWT || 'shhh';

const createTables = async () => {
  const SQL = `
  DROP TABLE IF EXISTS cart_products;
  DROP TABLE IF EXISTS carts;
  DROP TABLE IF EXISTS users;
  DROP TABLE IF EXISTS products;

  CREATE TABLE users(
    id UUID PRIMARY KEY,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    email VARCHAR(100) NOT NULL,
    password VARCHAR(100) NOT NULL,
    firstName VARCHAR(100),
    lastName VARCHAR(100),
    phone_number VARCHAR(100),
    is_admin BOOLEAN DEFAULT FALSE
  );

  CREATE TABLE products(
    id UUID PRIMARY KEY,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    name VARCHAR(100) NOT NULL,
    price NUMERIC NOT NULL,
    description VARCHAR(255) NOT NULL,
    inventory INTEGER
);

  CREATE TABLE carts(
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) NOT NULL
  );

  CREATE TABLE cart_products(
    id UUID PRIMARY KEY,
    cart_id UUID REFERENCES carts(id) NOT NULL,
    product_id UUID REFERENCES products(id) NOT NULL,
    quantity INTEGER NOT NULL,
    CONSTRAINT unique_cart_product UNIQUE (cart_id, product_id)
  );
  `;
  await client.query(SQL);
};

// all  products
const seeProducts = async()=> {
  const SQL = `
    SELECT *
    FROM products
  `;
  const response = await client.query(SQL);
  return response.rows;
};

// single product
const seeProduct = async(id)=> {
  const SQL = `
    SELECT *
    FROM products
    WHERE id=$1
  `;
  const response = await client.query(SQL, [id]);
  return response.rows;
};

//  log in user
const createUser = async ({email, password, is_admin}) => {
  const SQL = `
    INSERT INTO users(id, email, password, is_admin)
    VALUES($1, $2, $3, $4)
    RETURNING *
  `;
  const response = await client.query(SQL, [
    uuid.v4(),
    email,
    await bcrypt.hash(password, 5),
    is_admin
  ]);
  return response.rows[0];
};

// new cart
const createCart = async({user_id})=> {
  const SQL = `
    INSERT INTO carts(id, user_id )
    VALUES($1, $2)
    RETURNING *
  `;
  const response = await client.query(SQL,[uuid.v4(), user_id ]);
  return response.rows[0];
};

// see cart details
const seeCart = async(userId)=> {
  const GET_CART_ID = `
    SELECT *
    FROM carts
    WHERE user_id=$1
  `;
  const cartIdRes = await client.query(GET_CART_ID, [userId]);
    if (!cartIdRes) {
      throw new Error('No cart for that user')
    }
    return cartIdRes.rows[cartIdRes.rows.length-1];
};

// new cart product
const createCartProduct = async({cart_id, product_id, quantity})=> {
    const SQL = `
      INSERT INTO cart_products(id, cart_id, product_id, quantity)
      VALUES($1, $2, $3, $4)
      RETURNING *
    `;
    const response = await client.query(SQL,[uuid.v4(), cart_id, product_id, quantity]);
    return response.rows[0];
  };

// view cart products
const seeCartProducts = async(cart_id)=> {
    const SQL = `
      SELECT *
      FROM cart_products
      WHERE cart_id = $1
    `;
    const response = await client.query(SQL, [cart_id]);
    return response.rows;
};

// add a product to cart
const addProductToCart = async({cart_id, product_id, quantity}) => {
  const SQL = `
    INSERT
    INTO cart_products (id, cart_id, product_id, quantity)
    VALUES($1, $2, $3, $4)
    RETURNING *
  `;
  const response = await client.query(SQL, [uuid.v4(), cart_id, product_id, quantity]);
  return response.rows[0];
};

const deleteProductFromCart = async({cart_id, product_id}) => {
  const SQL = `
    DELETE
    FROM cart_products
    WHERE cart_id=$1 AND product_id=$2
    RETURNING *
  `;
  const response = await client.query(SQL, [cart_id, product_id]);
  return response.rows[0];
}

const changeQuantity = async({cart_id, product_id, quantity}) => {
  const SQL = `
    UPDATE cart_products
    SET quantity=$1
    WHERE product_id=$2 AND cart_id=$3
    RETURNING *
  `;
  const response = await client.query(SQL, [cart_id, product_id, quantity]);
  return response.rows[0];
}

const updateUser = async({firstName, lastName, phone_number, id})=> {
  const SQL = `
    UPDATE users
    SET firstName=$1, lastName=$2, phone_number=$3, updated_at=now()
    WHERE id=$4
    RETURNING *
  `;
  const response = await client.query(SQL, [firstName, lastName, phone_number, id]);
  return response.rows;
};

const deleteUser = async(id)=> {
  const SQL = `
    DELETE FROM users
    where id = $1
  `;
  await client.query(SQL, [id]);
};

// admin
const seeUsers = async()=> {
  const SQL = `
    SELECT *
    FROM users
  `;
  const response = await client.query(SQL);
  return response.rows;
};

const createProduct = async ({ name, price, description, inventory }) => {
  const SQL = `
    INSERT INTO products(id, name, price, description, inventory)
    VALUES($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const response = await client.query(SQL, [uuid.v4(), name, price, description, inventory]);
  return response.rows[0];
};

const updateProduct = async({ name, price, description, inventory })=> {
  const SQL = `
    UPDATE products
    SET name =$1 price=$2, description=$3, inventory=$4, updated_at= now()
    WHERE id = $5
    RETURNING *
  `;
  const response = await client.query(SQL, [{ name, price, description, inventory }]);
  return response.rows[0];
};

const deleteProduct = async(id)=> {
  const SQL = `
    DELETE FROM products
    where id = $1
  `;
  await client.query(SQL, [id]);
};

// password authentication
const authenticate = async({ email, password })=> {
  const SQL = `
    SELECT id, email, password
    FROM users
    WHERE email=$1;
  `;
  const response = await client.query(SQL, [email]);
  if(!response.rows.length || (await bcrypt.compare(password, response.rows[0].password)) === false){
    const error = Error('not authorized');
    error.status = 401;
    throw error;
  }
  const token = await jwt.sign({ id: response.rows[0].id}, JWT);
  return { token: token };
};

// use token to secure login process
const findUserWithToken = async(token)=> {
  let id;
  try {
    const payload = await jwt.verify(token, JWT);
    console.log({payload})
    id = payload.id;
  }
  catch(ex){
    const error = Error('not authorized');
    error.status = 401;
    throw error;
  }
  const SQL = `
    SELECT id, email
    FROM users
    WHERE id=$1;
  `;
  const response = await client.query(SQL, [id]);
  console.log(response.rows[0], 'line 269')
  if(!response.rows.length){
    const error = Error('not authorized');
    error.status = 401;
    throw error;
  }
  return response.rows[0];
};

module.exports = {
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
  findUserWithToken
};