
// set up ==========================================
var express = require("express");
var app = express();
var cfenv = require("cfenv");
var bodyParser = require('body-parser');
var fs = require('fs');
var path = require('path');
var stock = require('./stock');
var mydb;
var cloudant;
var dbCredentials = {
    dbName: 'my_stock_db'
};

// configuration =====================================
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({'extended':'true'}));
app.use(bodyParser.json());
app.use(bodyParser.json({ type: 'application/vnd.api+json' }));

initDBConnection();

// api calls =========================================
// post should add a stock to the db
app.post("/api/stocks", function (request, response) {
    console.log("Add A Stock Invoked..");
    console.log('Request Query: ' + JSON.stringify(request.query));
    var stockName = "";
    stockName = request.body.text;
    console.log("Adding Stock with Symbol: " + stockName);
    // have the stock name so begin stock lookup
    addStock(stockName, response);
    // new send list in json format
    var stocks = [];
    mydb.list({ include_docs: true }, function(err, body) {
      if (!err) {
        body.rows.forEach(function(row) {
          console.log(row);
          if(row.doc.id)
            stocks.push(createResponseData(row.doc.symbol,row.doc.name,row.doc.open,row.doc.close,row.doc.change,row.doc.low,row.doc.high));
        });
      }
    });
    //response.send(stocks);//was stockdata
});

// get should return all stocks in the db
app.get("/api/stocks", function (request, response) {
    var stocks = [];
    if(!mydb) {
      console.log("Error: no db exists")
      response.json(stocks);
      return;
    }
    mydb.list({ include_docs: true }, function(err, body) {
      if (!err) {
        body.rows.forEach(function(row) {
          console.log(row);
          stocks.push(createResponseData(row.doc.symbol,row.doc.name,row.doc.open,row.doc.close,row.doc.change,row.doc.low,row.doc.high));
          //stocks.push(row);
        });
        response.json(stocks);
      }
    });
    //response.send(stocks);
});

// deletes a stock from the db
app.delete("/api/stocks/:id", function (request,response){
    var id = request.params.id;
    console.log(request);
    console.log("Delete Invoked..");
    console.log("Removing document of ID: " + id);
    //console.log('Request Query: ' + JSON.stringify(request.query));
    mydb.get(id, {
        revs_info: true
    }, function(err, doc) {
        if (!err) {
            mydb.destroy(doc._id, doc._rev, function(err, res) {
                // Handle response
                if (err) {
                    console.log(err);
                    response.sendStatus(500);
                } else {
                    response.sendStatus(200);
                }
            });
        }
    });
});

app.get('*', function(req, res) {
    res.sendFile(path.join(__dirname, './public/index.html')); // load the single view file (angular will handle the page changes on the front-end)
});
var appEnv = cfenv.getAppEnv();

// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
});

app.get('/status', function(req, res){
    res.send({
        name: 'Stock Portfolio',
        description: 'A portfolio service is a grouping of stocks that directed by investors and/or managed by financial professionals.'
    });
});
// // listen (start app with node server.js)
// var port = process.env.PORT || 8080
// app.listen(port, function() {
//     console.log("To view your app, open this link in your browser: http://localhost:" + port);
// });

// DB Initialization ======================================
function getDBCredentialsUrl(jsonData) {
    var vcapServices = JSON.parse(jsonData);
    // Pattern match to find the first instance of a Cloudant service in
    // VCAP_SERVICES. If you know your service key, you can access the
    // service credentials directly by using the vcapServices object.
    for (var vcapService in vcapServices) {
        if (vcapService.match(/cloudant/i)) {
            return vcapServices[vcapService][0].credentials.url;
        }
    }
}

function initDBConnection() {
    //When running on Bluemix, this variable will be set to a json object
    //containing all the service credentials of all the bound services
    if (process.env.VCAP_SERVICES) {
        dbCredentials.url = getDBCredentialsUrl(process.env.VCAP_SERVICES);
    } else { //When running locally, the VCAP_SERVICES will not be set
        // When running this app locally you can get your Cloudant credentials
        // from Bluemix (VCAP_SERVICES in "cf env" output or the Environment
        // Variables section for an app in the Bluemix console dashboard).
        // Once you have the credentials, paste them into a file called vcap-local.json.
        // Alternately you could point to a local database here instead of a
        // Bluemix service.
        // url will be in this format: https://username:password@xxxxxxxxx-bluemix.cloudant.com
        dbCredentials.url = getDBCredentialsUrl(fs.readFileSync("vcap-local.json", "utf-8"));
    }
    cloudant = require('cloudant')(dbCredentials.url);
    // check if DB exists if not create
    cloudant.db.create(dbCredentials.dbName, function(err, res) {
        if (err) {
            console.log('Could not create new db: ' + dbCredentials.dbName + ', it might already exist.');
        }
    });
    mydb = cloudant.use(dbCredentials.dbName);
}


// Helper Methods ===================================================
// save data to database
function saveDocument(symbol, name, open, close, change, low, high) {
      mydb.insert({
          "id": symbol,
          "symbol": symbol,
          "name": name,
          "open": open,
          "close": close,
          "change": change,
          "low": low,
          "high": high }, symbol,function(err, doc) {
          if (err) {
              console.log(err);
              return 500;
          } else
             console.log('saved successfully')
          return 200;
        });
}
// create a stock object
function createResponseData(symbol, name, open, close, change, low, high) {
      var data = {
          id: symbol,
          symbol: symbol,
          name: name,
          open: open,
          close: close,
          change: change,
          low: low,
          high: high
      };
      return data;
}
// cleans a string
function sanitizeInput(str)  {
    return String(str).replace(/\n/g, "\\\\n").replace(/\r/g, "\\\\r").replace(/\t/g, "\\\\t")  ;
}
// asks yahoo finance api for stock data for the given name
function addStock(stockName, httpResponse){
    var http = require("http");
    //options to be used by http request
    var options = {
        host : 'download.finance.yahoo.com', // here only the domain name
        port : 80,
        path : '/d/quotes.csv?s=' + stockName + '&f=snopc1gh', // the rest of the url with parameters if needed
        method : 'GET' // do GET
    };
    // callback for the http request
    var callback = function(response){
      var body = '';
      response.on('data', function(data){
        body += data;
      });
      response.on('end', function(){
        console.log(body);
        var answer = body.split(",");
        var len = answer.length;
        // sanitize data
        for(var iAnswer = 0; iAnswer < answer.length; ++iAnswer)
        {
            answer[iAnswer] = answer[iAnswer].replace(/^\"|\"$/, "");
            answer[iAnswer] = answer[iAnswer].replace(/^\"|\"$/, "");
            answer[iAnswer] = answer[iAnswer].replace(/\n/, "");
        }
        console.log(JSON.stringify(answer));
        if (len!=7){
          console.log("Error in response from yahoo.")//response.send("500 - Error invalid response from server");
        }else{
          saveDocument(sanitizeInput(answer[0]), sanitizeInput(answer[1]), sanitizeInput(answer[2]), sanitizeInput(answer[3]), sanitizeInput(answer[4]), sanitizeInput(answer[5]), sanitizeInput(answer[6]))
        }
        httpResponse.json({"success": true});
      });
    }
    var req = http.request(options, callback);
    req.end();
};
