/** @jsx React.DOM */
var AppView = React.createClass({
  
  getInitialState: function(){
    return {
      userLoggedIn: true,
      querySent: false,
      queryResults: null,
      planApproved: false,
      query: null,
      mealPlanSelected: null,
      mealPlanModel: null,
      recipeQueue: null
    };
  },

  querySubmitted: function(recipesCollection, queryModel, recipeQueue){
    this.setState( {querySent: true, queryResults: recipesCollection, query: queryModel, recipeQueue: recipeQueue } );
  },

  mealPlanSubmitted: function (mealPlan) {
    this.setState({mealPlanSelected: true, mealPlanModel: mealPlan});
  },

  loggedIn: function(){
    this.setState({userLoggedIn: true});
  },

  render: function() {
    if(!this.state.userLoggedIn){
      return (
        <Login onSubmit={this.loggedIn} /> 
      );
    } else if(!this.state.querySent){
      return (
        <MealQuery onSubmit={this.querySubmitted} />
      );
    } else if (!this.state.mealPlanSelected) {
      return (
        <ReviewMeals recipes={this.state.queryResults} query={this.state.query} onSubmit={this.mealPlanSubmitted} recipeQueue={this.state.recipeQueue} />
      );
    } else {
      return (
        <ShoppingList mealPlan={this.state.mealPlanModel}/>
      );
    }
  }
});

React.render(<AppView />, document.body);
