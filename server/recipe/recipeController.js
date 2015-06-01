var appCodes = require('../config/config.js');
var http = require('http');
var Recipe = require('./recipeModel');
var RecipePreference = require('../recipePreference/recipePreferenceModel');

var allowedAllergyLibrary = {
  "Egg-Free": "397^Egg-Free",
  "Gluten-Free": "393^Gluten-Free",
  "Peanut-Free": "394^Peanut-Free",
  "Seafood-Free": "398^Seafood-Free",
  "Sesame-Free": "399^Sesame-Free",
  "Soy-Free": "400^Soy-Free",
  "Sulfite-Free": "401^Sulfite-Free",
  "Tree Nut-Free": "395^Tree Nut-Free",
  "Wheat-Free": "392^Wheat-Free"
};

var allowedCuisineLibrary = {
  "American": "cuisine^cuisine-american",
  "Italian": "cuisine^cuisine-italian",
  "Asian": "cuisine^cuisine-asian",
  "Mexican": "cuisine^cuisine-mexican",
  "Southern & Soul Food": "cuisine^cuisine-southern",
  "French": "cuisine^cuisine-french",
  "Indian": "cuisine^cuisine-indian",
  "Thai": "cuisine^cuisine-thai",
  "Japanese": "cuisine^cuisine-japanese",
  "Hawaiian": "cuisine^cuisine-hawaiian",
  "Swedish": "cuisine^cuisine-swedish",
};

var queryYummly = function (request, response) {
  //var allowedCuisine = request.body.allowedCuisine;
  var allowedAllergyList = request.body.allowedAllergy;
  // generate query for 10x meals requested by user in order to handle batch request
  var numResults = 10 * request.body.numMeals;

  //var numResults = request.body.numMeals;
  var start = request.body.additionalRequest ? request.body.totalRecipesRequested : 0;
  var queryString = "";
  var results = {};
  // add each allowed allergy to query string
  for (var key in allowedAllergyList) {
    if (allowedAllergyList[key]) {
      queryString += "&allowedAllergy[]" + allowedAllergyLibrary[key];
    }
  }
  //var query = "&allowedCuisine[]" + allowedCuisineLibrary[allowedCuisine] + "&allowedAllergy[]" + allowedAllergyLibrary[allowedAllergy] +"&requirePictures=true";
  var query =
    "http://api.yummly.com/v1/api/recipes?_app_id=" + appCodes.APPLICATION_ID +
    "&_app_key=" + appCodes.APPLICATION_KEY +
    queryString + "&allowedCourse[]=course^course-Main Dishes" + "&requirePictures=true" +
    "&maxResult=" + numResults + "&start=" + start;

  http.get(query, function(yummlyResponse){
    var str = '';
    //console.log('Response is '+yummlyResponse.statusCode);
    yummlyResponse.on('data', function (chunk) {
      str += chunk;
    });

    yummlyResponse.on('end', function () {

      results = JSON.parse(str);
      //check acceptability of recipe before saving
      for(var i = 0; i < results.matches.length; i++){
        //had to make a call to a function to retain recipe info #async
        saveRecipe(results.matches[i]);
      }
      getUserPreferences(results.matches, response);
      //response.status(200).send(results);
    });
  });
};

// var previousResults = [
//   { userId: 0,
//     recipeId: 'Vegetarian-Cabbage-Soup-Recipezaar',
//     preference: 0
//   },
//   { userId: 0,
//     recipeId: 'Chunky-Rice-And-Bean-Soup-Recipezaar',
//     preference: 1
//   },
//   { userId: 0,
//     recipeId: 'Tomato-Lentil-Soup-Recipezaar_3',
//     preference: 0
//   }
// ];


var kNearestNeighbors = function (userPreferences, matches, response) {
  //console.log('userPreferences: ', userPreferences[0].flavors, "matches: ", matches[2].flavors);
  for (var i = 0; i < matches.length; i++) {
    var yummlyMatch = matches[i];
    var likelihood = 0;
    for (var j = 0; j < userPreferences.length; j++) {
      var sumOfSquares = 0;

      var userPreference = userPreferences[j];

      for (var key in yummlyMatch.flavors) {
        var base = yummlyMatch.flavors[key] - userPreference.flavors[key];
        console.log('base: ', base);
        sumOfSquares += Math.pow(base, 2);
      }
      console.log('sumOfSquares: ', sumOfSquares);
      var distance = Math.sqrt(sumOfSquares);

      //if distance === 0 don't use distance as weighting factor
      likelihood += distance === 0 ? 0:(1 / distance) * userPreference.preference;
      console.log('distance: ', distance);
    }
    console.log('likelihood: ', likelihood);
    yummlyMatch.likelihood = likelihood;
  }
  matches.sort(function (a, b) {
    if (a.likelihood > b.likelihood) {
      return -1;
    }
    if (a.likelihood < b.likelihood) {
      return 1;
    }
    // a must be equal to b
    return 0;
  });
  console.log('matches: ', matches);
  response.status(200).send(matches);
};

var getUserPreferences = function (results, response) {
  var sortedResults = [];
  var userPreferences = [];

  // get previous flavor results from the user
  RecipePreference.where({'userId': 0})
  .fetchAll().then(function(preferences){
    if(preferences){
      for (var i = 0; i < preferences.models.length; i++) {
        userPreferences.push(preferences.models[i].attributes);
      }
    }
  }).then(function(){
    userPreferences.map(function(val, index, array){
      Recipe.where({yumId: val.recipeId}).fetch().then(function(recipe){
        var attr = recipe.attributes;
        val.flavors = attr.salty !== null ? {
          'salty':attr.salty,
          'sour':attr.sour,
          'sweet':attr.sweet,
          'bitter':attr.bitter,
          'piquant':attr.piquant,
          'meaty': attr.meaty
        } : null;
        if (index === array.length - 1) {
          kNearestNeighbors(array, results, response);
        }
      });
    })
  });

  // compare recipes from results to previous flavor results
    // for (var j = 0; j < results.length; j++) {
    //   var recipe = results[j];
    //   var recipeFlavors = recipe.flavors;
    //   for (var k = 0; k < previousResults.length; k++) {
    //     for (var key in recipeFlavors) {

    //     }
    //   }
    // }


  // calculate preference value from k nearest neighbors
  // store preference value in recipe object
  // sort recipe objects by preference values

  return sortedResults;
};

var saveRecipe = function(recipe){
  new Recipe({'yumId': recipe.id}).fetch().then(function(found){
    if(!found){
      //console.log(recipe);
      var newRecipe = new Recipe({
        'yumId': recipe.id,
        'recipeName': recipe.recipeName,
        'sourceDisplayName': recipe.sourceDisplayName,
        'smallImgUrl': recipe.smallImageUrls && recipe.smallImageUrls[0],
        'mediumImgUrl': recipe.mediumImageUrls && recipe.mediumImageUrls[0],
        'largeImgUrl': recipe.largeImageUrls && recipe.largeImageUrls[0],
        'cuisine': recipe.attributes.cuisine,
        'course': recipe.attributes.course,
        'holiday': recipe.attributes.holiday,
        'totalTimeInSeconds': recipe.totalTimeInSeconds,
        'ingredients':  recipe.ingredients,
        'rating':recipe.rating,
        'salty': recipe.flavors && recipe.flavors.salty,
        'sour': recipe.flavors && recipe.flavors.sour,
        'sweet':recipe.flavors && recipe.flavors.sweet,
        'bitter':recipe.flavors && recipe.flavors.bitter,
        'piquant':recipe.flavors && recipe.flavors.piquant,
        'meaty': recipe.flavors && recipe.flavors.meaty

      }).save().then(function(recipe){
        //console.log('saved recipe: ', recipe);
      });
    }
  });
};

module.exports = {
  createRecipes: function (request, response) {
    queryYummly(request, response);
  }
};

var requestFormat = {
  "numMeals": 3,
  "allowedAllergy": {
    "Egg-Free": false,
    "Gluten-Free": false,
    "Peanut-Free": true,
    "Seafood-Free": false,
    "Sesame-Free": false,
    "Soy-Free": false,
    "Sulfite-Free": false,
    "Tree Nut-Free": true,
    "Wheat-Free": false
  },
  "rejectedRecipeId": "902942",
  "totalRecipesRequested": 5
};
