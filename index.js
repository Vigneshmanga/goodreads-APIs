// ccbp start NJSIVDIHUV to setup the nxtwave ide

const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();

app.use(express.json());

const dbPath = path.join(__dirname, "goodreads.db");

let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3002, () => {
      console.log("server running at 3002");
    });
  } catch (e) {
    console.log(`db error : ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

// get books API

app.get("/books/", async (request, response) => {
  const query = `select * from book order by book_id asc;`;
  const booksArray = await db.all(query);

  response.send(booksArray);
});

// get specific book API

app.get("/book/:book_id", async (request, response) => {
  const { book_id } = request.params;

  const query = `select * from book where book_id = ${book_id};`;
  const book = await db.get(query);
  response.send(book);
});

// add book query

app.post("/books/", async (request, response) => {
  const bookDetails = request.body;
  const {
    title,
    authorId,
    rating,
    ratingCount,
    reviewCount,
    description,
    pages,
    dateOfPublication,
    editionLanguage,
    price,
    onlineStores,
  } = bookDetails;

  const query = `insert into book (title,author_id,rating,rating_count,review_count,description,pages,date_of_publication,edition_language,price,online_stores)
    values (
        '${title}',
         ${authorId},
         ${rating},
         ${ratingCount},
         ${reviewCount},
        '${description}',
         ${pages},
        '${dateOfPublication}',
        '${editionLanguage}',
         ${price},
        '${onlineStores}'
      );`;

  const dbResponse = await db.run(query);
  const bookId = dbResponse.lastID;
  response.send({ bookId: bookId });
});

//update book API

app.put("/books/:book_id", async (request, response) => {
  const { book_id } = request.params;

  const bookDetails = request.body;
  const {
    title,
    authorId,
    rating,
    ratingCount,
    reviewCount,
    description,
    pages,
    dateOfPublication,
    editionLanguage,
    price,
    onlineStores,
  } = bookDetails;
  const updateBookQuery = `
    UPDATE
      book
    SET
      title='${title}',
      author_id=${authorId},
      rating=${rating},
      rating_count=${ratingCount},
      review_count=${reviewCount},
      description='${description}',
      pages=${pages},
      date_of_publication='${dateOfPublication}',
      edition_language='${editionLanguage}',
      price=${price},
      online_stores='${onlineStores}'
    WHERE
      book_id = ${book_id};`;
  await db.run(updateBookQuery);
  response.send("Book Updated Successfully");
});

//delete book API

app.delete("/books/:bookId/", async (request, response) => {
  const { bookId } = request.params;
  const deleteBookQuery = `
    DELETE FROM
      book
    WHERE
      book_id = ${bookId};`;
  await db.run(deleteBookQuery);
  response.send("Book Deleted Successfully");
});

//get Author books API

app.get("/authors/:author_id/books/", async (request, response) => {
  const { author_id } = request.params;
  const query = `select * from book where author_id = ${author_id};`;
  const booksArray = await db.all(query);
  response.send(booksArray);
});

//get specific books using QUERY PARAMETERS

app.get("/query_books/", async (request, response) => {
  const {
    limit = 5,
    offset = 2,
    search_q = "",
    order = "ASC",
    order_by = "book_id",
  } = request.query;
  const query = `select * from book where title like '%${search_q}%' order by ${order_by} ${order} limit ${limit} offset ${offset};`;
  const booksArray = await db.all(query);
  response.send(booksArray);
});

//delete books contains specified name

app.delete("/query_delete_books/", async (request, response) => {
  const { search_q } = request.query;
  const query = `delete from book where title like '%${search_q}%'`;
  await db.run(query);
  response.send("deleted successfully");
});

//create user API

app.post("/users/", async (request, response) => {
  const { name, username, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `select * from user where username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `insert into user(username,name,password,gender,location) values ('${username}','${name}','${hashedPassword}','${gender}','${location}');`;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;
    response.send(`new user created with user id: ${newUserId}`);
  } else {
    response.status(400);
    response.send("user already exists");
  }
});

//login user API

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `select * from user where username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("invalid username");
  } else {
    const isPasswordValid = await bcrypt.compare(password, dbUser.password);
    if (isPasswordValid === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
      console.log(jwtToken);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("invalid password");
    }
  }
});

//get books API on verifying jwtToken

app.get("/books/verifying_jwtToken/", async (request, response) => {
  let jwtToken;
  const authHeaders = request.headers["authorization"];
  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(400);
    response.send("invalid access token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(400);
        response.send("invalid access token");
      } else {
        const getBooksQuery = `select * from book order by book_id asc;`;
        const booksArray = await db.all(getBooksQuery);
        response.send(booksArray);
      }
    });
  }
});

// get user profile and using middleware function

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(400);
    response.send("invalid access token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", (error, payload) => {
      if (error) {
        response.send("invalid access token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.get("/profile/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getProfileQuery = `select * from user where username = '${username}';`;
  const userProfile = await db.get(getProfileQuery);
  response.send(userProfile);
});
