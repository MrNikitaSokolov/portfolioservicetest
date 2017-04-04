var stockPortfolio = angular.module('stockPortfolio', []);

//stockPortfolio.controller('stockController', stockController);
stockPortfolio.controller('mainController', function($scope, $http){
  // init scope variables
  $scope.formData = {};
  $scope.companies = {};
  $scope.stockLoading = false;
  //$scope.stocks = {};
  $scope.closetotal = 0;
  $scope.opentotal = 0;
  $scope.totalchange = 0;

  // get company data from server
  function getCompanies(){
    $http.get('/companies.json')
      .success(function(data) {
         $scope.companies = JSON.stringify(data);
         console.log("success fetching companies");
      }).error(function(data){
          console.log("error fetching companies")
      });
  }
  getCompanies();
  // when landing, get all stocks and show them
  refreshStocks();

  function calculateTotals(){
    console.log("calculating total");
    var total = 0;
    var open = 0;
    console.log("stocks:" + $scope.stocks[0].symbol);
    for (var i=0;i<$scope.stocks.length;i++){
      total += Number($scope.stocks[i].close);
      open += Number($scope.stocks[i].open);
    }
    $scope.closetotal = total;
    $scope.opentotal = open;
    $scope.totalchange = total - open;
  }

  function refreshStocks() {
    $scope.stockLoading = true;
      $http.get('/api/stocks')
      .success(function(data){
        $scope.stockLoading = false;
        $scope.stocks = angular.fromJson(data);
        calculateTotals();
      })
      .error(function(data){
        $scope.stockLoading = false;
        console.log('Error fetching stocks: ' + data);
      });
  }

  // when submitting add stock form send test to my node api
  $scope.createStock = function(){
    $http.post('/api/stocks',$scope.formData)
    .success(function(data){
      $scope.formData = {};
      // $scope.stocks = data.data;
      refreshStocks();
      console.log(data);
    })
    .error(function(data){
      console.log('Error creating stock: '+ data);
    });
  };

  // delete a stock after checking it
  $scope.deleteStock = function(stock){
    //JSON.parse(stock)
    console.log("Stock to delete: " + stock);
    $http.delete('/api/stocks/' + stock)
    .success(function(data){
      // $scope.stocks = data.data;
      refreshStocks();
    })
    .error(function(data){
      console.log('Error deleting stock: '+ data);
    });
  };

});
