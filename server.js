"use strict";
const express = require("express");
const app = express();
const port = 3000;

var mongoose = require("mongoose");
// DB CONFIG
const dbase = require("./config/keys").mongoUri;

//CONNECT TO MOGODB
mongoose
  .connect(
    dbase,
    { useNewUrlParser: true }
  )
  .then(() => {
    console.log("MONGODB Connected");
  })
  .catch(error => {
    console.log(error);
  });

var request = require("request");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "pug");
app.set("views", __dirname + "/views");
module.exports = app;

var Stock = require("./models/Stock");
var Company = require("./models/LookUpSchema");
var Favourites = require("./models/FavStock");
var User = require("./models/User");
var Article = require("./models/MarketNewsSchema");

var session = "";
var company = {};

var db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function() {
  app.get("/", (req, res) => {
    if (session === "") {
      res.render("login", { user: {} });
    } else {
      res.render("index", { title: "Welcome " + session, stocks: company });
    }
    console.log(session);
    console.log(req.body);
  });
  app.get("/api/signup", (req, res) => {
    res.render("register", {});
  });
  app.get("/api/charts", (req, res) => {
    res.render("interactivechart", {});
  });
  app.get("/api/logout", (req, res) => {
    session = "";
    res.render("login", { user: {} });
  });
  app.post("/login", (req, res) => {
    console.log(req.body.email);

    User.findOne(
      { Email: req.body.email, Password: req.body.password },
      function(err, login) {
        if (err) {
          console.log(err);
          res.render("error", {});
        } else {
          if (login === null) {
            res.render("error", { message: "Username or password incorrect" });
          } else {
            Favourites.find({}, function(err, stocks) {
              if (err) {
                console.log(err);
                res.render("error", {});
              } else {
                session = login.Name;
                res.render("index", {
                  title: "Welcome " + login.Name,
                  stocks: stocks
                });
              }
            });
          }
        }
      }
    );
  });
  app.post("/register", (req, res) => {
    //res.render('index', {})
    console.log(req.body);

    var newUser = new User(req.body);

    newUser.save(function(err) {
      if (err) {
        throw err;
      } else {
        res.render("login", { user: req.body });
      }
    });
  });
  app.get("/home", (req, res) => {
    Favourites.find({}, function(err, stocks) {
      if (err) {
        console.log(err);
        res.render("error", {});
      } else {
        res.render("index", { stocks: stocks });
      }
    });
  });

  /* search functions */
  app.get("/search", (req, res) => {
    res.render("search", { title: "Search", query: {} });
    console.log("rendering search");
  });

  app.get("/api/search", (req, res) => {
    res.render("search", { title: "Search", query: {} });
    console.log("rendering search");
  });

  /* view the financial reports for a particular company */
  /* with parameters for searching different ranges */
  app.get("/stock/financials", (req, res) => {
    res.render("Financials", { title: "financials", query: {} });
    console.log("rendering full page financials");
  });

  /* show market stats for certain ranges */
  app.get("/stock/market", (req, res) => {
    res.render("market", { title: "market", query: {} });
    console.log("rendering market stats");
  });

  /* view all supported stock symbols by order of ___ */
  /* in order of gains in the past ___ */
  /* in order of dividends in the past ___ */
  /* in order of earnings in the past ____ */

  /* show news on market */
  app.get("/news", (req, res) => {
    res.render("news", { title: "news", query: {} });
    console.log("loading news");
  });

  /* get news articles for entire market  */
  app.get("/api/marketNews", function(req, res) {
    var query = {
      symbol: req.body.id
    };

    var options = {
      url: "https://api.iextrading.com/1.0/stock/market/news/last/10",
      method: "GET",
      qs: query
    };

    request(options, function(err, request, body) {
      var jsonBody = JSON.parse(body);
      var articles = jsonBody.map(function(data) {
        return new Article(data);
      });
      console.log(jsonBody.length);
      console.log(articles.length);

      res.render("news", { Article: articles });
    });
  });

  app.post("api/marketNews", function(req, res) {});

  /* show news for a single market */
  app.post("/api/coNews/", function(req, res) {
    var query = {
      input: req.body.id
    };

    console.log("query: " + query);
    console.log(query.toString());
    console.log("qin: " + query.input);

    var thisCompany = req.body.id;
    console.log(thisCompany);

    var options = {
      url:
        "https://api.iextrading.com/1.0/stock/" + thisCompany + "/news/last/20",
      method: "GET"
    };

    console.log(options);

    request(options, function(err, request, body) {
      console.log("BODY: " + body);

      var jsonBody = JSON.parse(body);
      console.log(jsonBody);

      var articles = jsonBody.map(function(data) {
        console.log(articles);
        return new Article(data);
      });

      console.log("ARTICLES: " + { Article: articles });
      res.render("news", { Article: articles });
    });
  });

  app.post("/api/stock", function(req, res) {
    var query = {
      symbol: req.body.id
    };

    var options = {
      url: "http://dev.markitondemand.com/MODApis/Api/v2/Quote/json",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      qs: query
    };

    request(options, function(err, request, body) {
      // markitondemand return status 200 whether if found stock or not
      // if it found stock there will not be a message field
      // if found stock then and only then save data to MongoDB
      var jsonBody = JSON.parse(body);
      jsonBody.user = session;
      if (!jsonBody.Message) {
        var newStocks = new Stock(jsonBody);

        newStocks.save(function(err) {
          if (err) {
            throw err;
          } else {
            console.log(jsonBody);
            res.render("landingpage", { company: newStocks });
          }
        });
        //   res.render('landingpage',{company:newStocks})
      }
    });
  });
  app.post("/api/lookup", function(req, res) {
    var query = {
      input: req.body.id
    };

    var options = {
      url: "http://dev.markitondemand.com/MODApis/Api/v2/Lookup/json",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      qs: query
    };

    request(options, function(err, request, body) {
      // markitondemand return status 200 whether if found stock or not
      // if it found stock there will not be a message field
      // if found stock then and only then save data to MongoDB
      var jsonBody = JSON.parse(body);
      if (!jsonBody.Message) {
        console.log(jsonBody);
        var lookupInfo = new Company(jsonBody);

        lookupInfo.save(function(err) {
          if (err) {
            throw err;
          } else {
            console.log(jsonBody);
            res.render("lookup-detail", { query: jsonBody });
          }
        });
        //remove next line and uncomment above
        //res.render('lookup-detail',{query:jsonBody})
      }
    });
  });
  app.get("/api/stock", (req, res) => {
    res.render("find-stock", { title: "Find Stock", company: {} });
    console.log(req.body.id);
  });
  app.get("/api/history", (req, res) => {
    Stock.find({}, function(err, stocks) {
      if (err) {
        console.log(err);
        res.render("error", {});
      } else {
        res.render("history", { stocks: stocks });
      }
    });
  });
  app.get("/api/lookup", (req, res) => {
    res.render("look-up", { title: "Look Up", query: {} });
    console.log(req.body.id);
  });

  app.get("/stock/new/:Symbol", (req, res) => {
    Stock.findOne({ symbol: req.params.Symbol }, function(err, stocks) {
      if (err) {
        console.log(err);
        res.render("error", {});
      } else {
        console.log(stocks);
        if (stocks === null) {
          res.render("error", { message: "Not found" });
        } else {
          // res.status(200).send(book)
          // res.render('index', { stocks: stocks})
          var fav = new Favourites(stocks);
          fav.save(function(err) {
            if (err) {
              throw err;
            } else {
              console.log(jsonBody);
              res.render("index", { stocks: stocks });
            }
          });
        }
      }
    });
  });
  app.get("/stock/:symbol", (req, res) => {
    var query = {
      symbol: req.params.symbol
    };

    var options = {
      url: "http://dev.markitondemand.com/MODApis/Api/v2/Quote/json",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      qs: query
    };

    request(options, function(err, request, body) {
      // markitondemand return status 200 whether if found stock or not
      // if it found stock there will not be a message field
      // if found stock then and only then save data to MongoDB
      console.log("inside");
      var jsonBody = JSON.parse(body);
      if (!jsonBody.Message) {
        jsonBody.user = session;
        var newStocks = new Stock(jsonBody);

        newStocks.save(function(err) {
          if (err) {
            throw err;
          } else {
            console.log(jsonBody);
            res.render("landingpage", { company: newStocks });
          }
        });
        //  res.render('landingpage',{company:newStocks})
      }
    });
  });
});
app.listen(port, () => console.log(`Example app listening on port ${port}!`));
