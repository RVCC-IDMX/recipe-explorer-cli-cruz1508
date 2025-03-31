// src/app.js
/**
 * Main application file for the Recipe Explorer
 * Contains the command-line interface and application logic
 */

import readlineSync from 'readline-sync';
import * as api from './api.js';
import * as cache from './cache.js';
import * as favorites from './favorites.js';
import * as utils from './utils.js';

/**
 * Initialize the application
 *
 * @returns {Promise<boolean>} - True if initialization successful
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all | MDN: Promise.all}
 */
async function initialize() {
  // CHALLENGE 18: Implement initialize function
  // 1. Use Promise.all to initialize both the cache and favorites in parallel
  // 2. After initialization, clear expired cache entries
  // 3. Return true if successful
  // 4. Catch any errors, log them, and return false

  try {
    await Promise.all([cache.initialize(), favorites.initialize()]);
    cache.clearExpired();
    return true;
  } catch (error) {
    console.error('Error initializing application:', error.message);
    return false;
  }
}

/**
 * Search for recipes with caching
 * Demonstrates using cache before making API calls
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises | MDN: Using promises}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch | MDN: try...catch}
 */
async function searchRecipes() {
  const query = readlineSync.question('Enter search term: ');

  if (!query.trim()) {
    console.log('Search term cannot be empty');
    return;
  }

  console.log(`Searching for "${query}"...`);

  try {
    const cacheKey = `search_${query.toLowerCase()}`;
    const results = await cache.getCachedOrFetch(cacheKey, () => api.searchMealsByName(query));
    console.log(utils.formatRecipeList(results));

    if (results.length > 0) {
      const recipeChoice = readlineSync.questionInt('Enter recipe number to view details or 0 to cancel: ');

      if (recipeChoice > 0) {
        await viewRecipeDetails(results[recipeChoice - 1].idMeal);
      }
    }
  } catch (error) {
    console.error('Error searching recipes:', error.message);
  }
}

/**
 * View recipe details with related recipes
 * Demonstrates Promise chaining
 *
 * @param {string} recipeId - ID of recipe to view
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises | MDN: Using promises}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then | MDN: Promise.then}
 */
async function viewRecipeDetails(recipeId) {
  if (!recipeId) {
    recipeId = readlineSync.question('Enter recipe ID: ');
  }

  if (!recipeId.trim()) {
    console.log('Recipe ID cannot be empty');
    return;
  }

  console.log(`Fetching details for recipe ${recipeId}...`);

  try {
    const cacheKey = `recipe_${recipeId}`;
    const recipeDetails = await cache.getCachedOrFetch(cacheKey, () => api.getMealById(recipeId));

    if (!recipeDetails) {
      console.log('Recipe not found');
      return;
    }

    console.log(utils.formatRecipe(recipeDetails));

    const isFavorite = await favorites.isFavorite(recipeId);

    if (isFavorite) {
      const removeFavorite = readlineSync.keyInYNStrict('This recipe is in your favorites. Would you like to remove it?');
      if (removeFavorite) {
        await favorites.removeFavorite(recipeId);
      }
    } else {
      const addFavorite = readlineSync.keyInYNStrict('Would you like to add this recipe to your favorites?');
      if (addFavorite) {
        await favorites.addFavorite(recipeDetails);
      }
    }

    const relatedRecipes = await api.getRelatedMeals(recipeDetails.strCategory);
    console.log('Related Recipes:');
    console.log(utils.formatRecipeList(relatedRecipes));
  } catch (error) {
    console.error('Error viewing recipe details:', error.message);
  }
}

/**
 * Explore recipes by first letter
 * Demonstrates using Promise.all
 */
async function exploreByFirstLetter() {
  const letters = readlineSync.question('Enter up to 3 letters to search (e.g. abc): ');

  if (!letters.trim()) {
    console.log('Please enter at least one letter');
    return;
  }

  const uniqueLetters = Array.from(new Set(letters.toLowerCase())).slice(0, 3);

  console.log(`Searching for recipes starting with: ${uniqueLetters.join(', ')}...`);

  try {
    const cacheKey = `letters_${uniqueLetters.sort().join('')}`;
    const recipes = await cache.getCachedOrFetch(cacheKey, () => api.searchMealsByFirstLetter(uniqueLetters));
    console.log(utils.formatRecipeList(recipes));

    if (recipes.length > 0) {
      const recipeChoice = readlineSync.questionInt('Enter recipe number to view details or 0 to cancel: ');

      if (recipeChoice > 0) {
        await viewRecipeDetails(recipes[recipeChoice - 1].idMeal);
      }
    }
  } catch (error) {
    console.error('Error exploring recipes by first letter:', error.message);
  }
}
/**
 * Search recipes by ingredient with timeout
 * Demonstrates using Promise.race for timeout
 */
async function searchByIngredient() {
  const ingredient = readlineSync.question('Enter an ingredient: ');

  if (!ingredient.trim()) {
    console.log('Ingredient cannot be empty');
    return;
  }

  console.log(`Searching for recipes with ${ingredient}...`);

  try {
    const cacheKey = `ingredient_${ingredient.toLowerCase()}`;
    const recipes = await cache.getCachedOrFetch(cacheKey, () => api.getMealsByIngredient(ingredient));

    if (typeof recipes === 'string') {
      console.log(recipes);
      return;
    }

    console.log(utils.formatRecipeList(recipes));

    if (recipes.length > 0) {
      const recipeChoice = readlineSync.questionInt('Enter recipe number to view details or 0 to cancel: ');

      if (recipeChoice > 0) {
        await viewRecipeDetails(recipes[recipeChoice - 1].idMeal);
      }
    }
  } catch (error) {
    console.error('Error searching by ingredient:', error.message);
  }
}
/**
 * View favorite recipes
 */
async function viewFavorites() {
  try {
    const favoriteRecipes = await favorites.getFavorites();

    if (favoriteRecipes.length === 0) {
      console.log('You have no favorite recipes');
      return;
    }

    console.log(utils.formatRecipeList(favoriteRecipes));

    const viewDetails = readlineSync.keyInYN('Would you like to view details for a recipe?');

    if (viewDetails) {
      const index = readlineSync.questionInt(`Enter recipe number (1-${favoriteRecipes.length}): `, {
        limit: input => {
          const num = parseInt(input);
          return num >= 1 && num <= favoriteRecipes.length;
        },
        limitMessage: `Please enter a number between 1 and ${favoriteRecipes.length}`
      });

      await viewRecipeDetails(favoriteRecipes[index - 1].idMeal);
    }
  } catch (error) {
    console.error('Error viewing favorites:', error.message);
  }
}

/**
 * Discover random recipes
 * Demonstrates Promise.race to get the first of several random recipes
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race | MDN: Promise.race}
 */
async function discoverRandom() {
  console.log('Fetching random recipes...');

  try {
    const promises = [api.getRandomMeal(), api.getRandomMeal(), api.getRandomMeal()];
    const randomRecipe = await Promise.race(promises);

    if (!randomRecipe) {
      console.log('No random recipe found');
      return;
    }

    console.log(utils.formatRecipe(randomRecipe));

    const isFavorite = await favorites.isFavorite(randomRecipe.idMeal);

    if (isFavorite) {
      const removeFavorite = readlineSync.keyInYNStrict('This recipe is in your favorites. Would you like to remove it?');
      if (removeFavorite) {
        await favorites.removeFavorite(randomRecipe.idMeal);
      }
    } else {
      const addFavorite = readlineSync.keyInYNStrict('Would you like to add this recipe to your favorites?');
      if (addFavorite) {
        await favorites.addFavorite(randomRecipe);
      }
    }
  } catch (error) {
    console.error('Error discovering random recipes:', error.message);
  }
}

/**
 * Display the main menu and handle user input
 */
async function showMainMenu() {
  console.log('\n===== RECIPE EXPLORER =====');
  console.log('1. Search recipes');
  console.log('2. View recipe details by ID');
  console.log('3. Explore recipes by first letter');
  console.log('4. Search by ingredient');
  console.log('5. View favorites');
  console.log('6. Discover random recipe');
  console.log('7. Exit');

  const choice = readlineSync.questionInt('Enter your choice (1-7): ', {
    limit: [1, 2, 3, 4, 5, 6, 7],
    limitMessage: 'Please enter a number between 1 and 7'
  });

  switch (choice) {
    case 1:
      await searchRecipes();
      break;
    case 2:
      await viewRecipeDetails();
      break;
    case 3:
      await exploreByFirstLetter();
      break;
    case 4:
      await searchByIngredient();
      break;
    case 5:
      await viewFavorites();
      break;
    case 6:
      await discoverRandom();
      break;
    case 7:
      console.log('Thank you for using Recipe Explorer!');
      process.exit(0);
  }

  // Return to main menu after function completes
  return showMainMenu();
}

/**
 * Main application entry point
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function | MDN: async function}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch | MDN: Promise.catch}
 */
async function main() {
  // CHALLENGE 24: Implement main function
  // 1. Display an initialization message
  // 2. Call initialize() to set up the application
  // 3. Handle initialization failure (exit with error code 1)
  // 4. Display a welcome message on success
  // 5. Start the main menu loop by calling showMainMenu()
  // 6. Add error handling for any uncaught exceptions

  try {
    console.log('Initializing application...');
    const initialized = await initialize();

    if (!initialized) {
      console.error('Initialization failed');
      process.exit(1);
    }

    console.log('Welcome to Recipe Explorer!');
    await showMainMenu();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default {
  main,
  searchRecipes,
  viewRecipeDetails,
  exploreByFirstLetter,
  searchByIngredient,
  viewFavorites,
  discoverRandom
};