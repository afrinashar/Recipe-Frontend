import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const emptyIngredient = { name: "", quantity: "", unit: "" };
const emptyStep = { description: "", timer: "" };
const getLocalDate = () => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().slice(0, 10);
};
const initialForm = {
  title: "",
  description: "",
  category: "",
  cuisine: "",
  difficulty: "",
  preparationTime: "",
  cookingTime: "",
  servings: "",
  coverImage: "",
  tags: "",
  ingredients: [{ ...emptyIngredient }],
  steps: [{ ...emptyStep }],
};

function App() {
  const [recipes, setRecipes] = useState([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All recipes");
  const [saved, setSaved] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [status, setStatus] = useState("Loading your recipes...");
  const [form, setForm] = useState(initialForm);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [cookingSessions, setCookingSessions] = useState([]);
  const [diaryDate, setDiaryDate] = useState(getLocalDate);
  const [diaryRating, setDiaryRating] = useState(0);
  const [diaryNotes, setDiaryNotes] = useState("");
  const [resultPhoto, setResultPhoto] = useState(null);
  const [resultPhotoPreview, setResultPhotoPreview] = useState("");
  const [diaryStatus, setDiaryStatus] = useState("");
  const [listeningField, setListeningField] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("");
  const recognitionRef = useRef(null);

  const categories = useMemo(
    () => [
      "All recipes",
      ...new Set(recipes.map((recipe) => recipe.category).filter(Boolean)),
    ],
    [recipes],
  );
  const filteredRecipes = recipes;

  const loadRecipes = useCallback(
    async (requestedPage = 1, append = false) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: requestedPage, limit: 12 });
        if (debouncedQuery.trim()) params.set("search", debouncedQuery.trim());
        if (activeCategory !== "All recipes")
          params.set("category", activeCategory);
        const response = await fetch(`/api/recipes?${params}`);
        if (!response.ok) throw new Error("Could not load recipes");
        const data = await response.json();
        setRecipes((current) =>
          append ? [...current, ...data.recipes] : data.recipes,
        );
        setPage(data.page);
        setHasMore(data.page < data.pages);
        setStatus(
          data.total
            ? ""
            : "Your recipe book is empty. Add your first recipe below.",
        );
      } catch {
        setStatus(
          "Connect MongoDB and start the API to load your saved recipes.",
        );
      } finally {
        setLoading(false);
      }
    },
    [activeCategory, debouncedQuery],
  );

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!selectedRecipe?._id) return;
    setCookingSessions([]);
    setDiaryDate(getLocalDate());
    setDiaryRating(0);
    setDiaryNotes("");
    setResultPhoto(null);
    setDiaryStatus("");
    fetch(`/api/recipes/${selectedRecipe._id}/cooking-sessions`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setCookingSessions(data.sessions))
      .catch(() => setCookingSessions([]));
  }, [selectedRecipe]);

  useEffect(() => {
    if (!resultPhoto) {
      setResultPhotoPreview("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(resultPhoto);
    setResultPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [resultPhoto]);

  const startDictation = (field, currentValue, setValue) => {
    if (listeningField === field) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("Voice typing is not supported in this browser. You can still type your note.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.onstart = () => setListeningField(field);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      setValue([currentValue.trim(), transcript].filter(Boolean).join(" "));
      setVoiceStatus("");
    };
    recognition.onerror = () => setVoiceStatus("Could not hear that. Check microphone permission and try again.");
    recognition.onend = () => setListeningField("");
    recognitionRef.current = recognition;
    recognition.start();
  };

  const submitCookingSession = async (event) => {
    event.preventDefault();
    if (!diaryRating) {
      setDiaryStatus("Choose a star rating for this cooking result.");
      return;
    }
    const sessionData = new FormData();
    sessionData.append("cookedAt", diaryDate);
    sessionData.append("rating", String(diaryRating));
    sessionData.append("notes", diaryNotes);
    if (resultPhoto) sessionData.append("resultPhoto", resultPhoto);
    setDiaryStatus("Saving cooking note...");
    try {
      const response = await fetch(`/api/recipes/${selectedRecipe._id}/cooking-sessions`, { method: "POST", body: sessionData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not save cooking note");
      setCookingSessions((current) => [data, ...current]);
      setDiaryDate(getLocalDate());
      setDiaryRating(0);
      setDiaryNotes("");
      setResultPhoto(null);
      setDiaryStatus("Cooking note saved.");
      event.target.reset();
    } catch (error) {
      setDiaryStatus(error.message || "Could not save cooking note. Check the API connection.");
    }
  };
  const updateForm = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const updateArrayItem = (field, index, key, value) =>
    setForm((current) => ({
      ...current,
      [field]: current[field].map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    }));
  const addArrayItem = (field, value) =>
    setForm((current) => ({
      ...current,
      [field]: [...current[field], { ...value }],
    }));
  const removeArrayItem = (field, index) =>
    setForm((current) => ({
      ...current,
      [field]: current[field].filter((_, itemIndex) => itemIndex !== index),
    }));

  const submitRecipe = async (event) => {
    event.preventDefault();
    setStatus("Saving recipe...");
    const payload = {
      ...form,
      preparationTime: Number(form.preparationTime) || 0,
      cookingTime: Number(form.cookingTime) || 0,
      servings: Number(form.servings) || 0,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      ingredients: form.ingredients.filter((item) => item.name.trim()),
      steps: form.steps.filter((item) => item.description.trim()),
    };
    try {
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Could not save recipe");
      setForm(initialForm);
      setFormOpen(false);
      await loadRecipes(1);
    } catch {
      setStatus(
        "Recipe was not saved. Make sure MongoDB and the API are running.",
      );
    }
  };

  return (
    <div className="app-shell">
      {selectedRecipe && (
        <div className="modal-backdrop" onClick={() => setSelectedRecipe(null)}>
          <aside
            className="recipe-panel detail-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="close-button"
              onClick={() => setSelectedRecipe(null)}
              aria-label="Close recipe"
            >
              ×
            </button>
            <p className="section-kicker">RECIPE DETAIL</p>
            <h2>{selectedRecipe.title}</h2>
            <p className="panel-intro">
              {selectedRecipe.description ||
                "A recipe from your cooking notebook."}
            </p>
            <div className="detail-meta">
              <span>{selectedRecipe.category || "Uncategorised"}</span>
              <span>{selectedRecipe.cookingTime || 0} minutes</span>
              <span>{selectedRecipe.servings || 0} servings</span>
            </div>
            <h3>Ingredients</h3>
            <ul className="detail-list">
              {selectedRecipe.ingredients?.map((ingredient, index) => (
                <li key={index}>
                  <span>{ingredient.name}</span>
                  <small>
                    {ingredient.quantity} {ingredient.unit}
                  </small>
                </li>
              ))}
            </ul>
            <h3>Cooking steps</h3>
            <ol className="detail-steps">
              {selectedRecipe.steps?.map((step, index) => (
                <li key={index}>
                  <span>{index + 1}</span>
                  <div>
                    {step.description}
                    {step.timer ? (
                      <small>{step.timer} minute timer</small>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
            <section className="diary-section">
              <p className="section-kicker">COOKING DIARY</p>
              <h3>How did it turn out?</h3>
              <form className="diary-form" onSubmit={submitCookingSession}>
                <label className="diary-date-label">
                  Cooked on
                  <input
                    type="date"
                    value={diaryDate}
                    onChange={(event) => setDiaryDate(event.target.value)}
                    required
                  />
                </label>
                <fieldset className="rating-picker">
                  <legend>Your result rating</legend>
                  <div role="radiogroup" aria-label="Rating from one to five stars">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        type="button"
                        key={rating}
                        className={rating <= diaryRating ? "star selected" : "star"}
                        aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
                        aria-pressed={diaryRating === rating}
                        onClick={() => setDiaryRating(rating)}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="diary-notes-label">
                  Notes for next time
                  <textarea
                    rows="3"
                    value={diaryNotes}
                    onChange={(event) => setDiaryNotes(event.target.value)}
                    placeholder="What worked? What would you change?"
                  />
                </label>
                <button
                  type="button"
                  className={`voice-button ${listeningField === "diary" ? "listening" : ""}`}
                  onClick={() => startDictation("diary", diaryNotes, setDiaryNotes)}
                >
                  {listeningField === "diary" ? "Listening... tap to stop" : "Dictate note"}
                </button>
                {voiceStatus && <p className="diary-status" role="status">{voiceStatus}</p>}
                <label className="photo-picker">
                  <span>{resultPhoto ? resultPhoto.name : "Add a photo of your result"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={(event) => setResultPhoto(event.target.files?.[0] || null)}
                  />
                </label>
                {resultPhotoPreview && <img className="result-preview" src={resultPhotoPreview} alt="Preview of your cooking result" />}
                <button className="primary-button submit-button" type="submit">Save cooking note <span>→</span></button>
                {diaryStatus && <p className="diary-status" role="status">{diaryStatus}</p>}
              </form>
              <div className="diary-history">
                <h4>Past cooking notes <span>{cookingSessions.length}</span></h4>
                {!cookingSessions.length && <p className="history-empty">Your cooking attempts will be saved here.</p>}
                {cookingSessions.map((session) => (
                  <article className="diary-entry" key={session._id}>
                    <div className="diary-entry-heading">
                      <time dateTime={session.cookedAt}>{new Date(session.cookedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</time>
                      <span className="diary-entry-stars" aria-label={`${session.rating} out of 5 stars`}>{"★".repeat(session.rating)}{"☆".repeat(5 - session.rating)}</span>
                    </div>
                    {session.notes && <p>{session.notes}</p>}
                    {session.resultPhoto && <img className="diary-entry-photo" src={session.resultPhoto} alt={`Cooking result from ${new Date(session.cookedAt).toLocaleDateString()}`} />}
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </div>
      )}
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark">m</span>
          <span>mise en place</span>
        </a>
        <nav>
          <a className="active" href="#discover">
            My recipes
          </a>
          <a href="#all">Discover</a>
        </nav>
        <div className="top-actions">
          <button
            className="primary-button small-button"
            onClick={() => setFormOpen(true)}
          >
            + Add recipe
          </button>
        </div>
      </header>
      <main id="top">
        <section className="hero-section" id="discover">
          <div className="eyebrow">
            <span className="eyebrow-line" /> YOUR COOKING NOTEBOOK
          </div>
          <h1>
            Your recipes, <em>your table.</em>
          </h1>
          <p className="hero-copy">
            Keep every ingredient, step, and kitchen memory
            <br className="desktop-only" /> in one place.
          </p>
          <div className="search-wrap">
            <span className="search-icon">/</span>
            <input
              aria-label="Search recipes"
              placeholder="Search your recipes..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </section>
        <section className="content-section" id="all">
          <div className="section-heading">
            <div>
              <p className="section-kicker">YOUR COLLECTION</p>
              <h2>
                {recipes.length
                  ? "Everything you have made."
                  : "Start your recipe book."}
              </h2>
            </div>
            <button
              className="text-link text-button"
              onClick={() => setFormOpen(true)}
            >
              Add a recipe <span>→</span>
            </button>
          </div>
          <div className="category-row">
            {categories.map((category) => (
              <button
                key={category}
                className={
                  activeCategory === category ? "category active" : "category"
                }
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="recipe-grid">
            {filteredRecipes.map((recipe) => (
              <article
                className="recipe-card"
                key={recipe._id}
                onClick={() => setSelectedRecipe(recipe)}
              >
                <div className="recipe-image">
                  {recipe.coverImage ? <img src={recipe.coverImage} alt={recipe.title} /> : <div className="recipe-placeholder">Add a cover photo</div>}
                  <button
                    className={`save-button ${saved.includes(recipe._id) ? "saved" : ""}`}
                    aria-label={`Save ${recipe.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSaved((current) =>
                        current.includes(recipe._id)
                          ? current.filter((item) => item !== recipe._id)
                          : [...current, recipe._id],
                      );
                    }}
                  >
                    {saved.includes(recipe._id) ? "♥" : "♡"}
                  </button>
                </div>
                <div className="recipe-info">
                  <div className="recipe-meta">
                    <span>{recipe.category || "Uncategorised"}</span>
                    <span>{recipe.cookingTime || 0} min</span>
                  </div>
                  <h3>{recipe.title}</h3>
                  <p className="author">
                    {recipe.description || "No description added yet."}
                  </p>
                  <div className="rating">
                    <span>{recipe.difficulty || "Difficulty not set"}</span>
                    <small> · {recipe.servings || 0} servings</small>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!filteredRecipes.length && (
            <div className="empty-state">
              <h3>{status || "No recipes match your search."}</h3>
              <p>Recipes you save will appear here.</p>
              <button
                className="primary-button"
                onClick={() => setFormOpen(true)}
              >
                Add your first recipe <span>→</span>
              </button>
            </div>
          )}
          {hasMore && (
            <button
              className="load-more"
              disabled={loading}
              onClick={() => loadRecipes(page + 1, true)}
            >
              {loading ? "Loading..." : "Load more recipes"}
            </button>
          )}
        </section>
        <section className="quote-section">
          <span className="quote-mark">“</span>
          <blockquote>
            The kitchen is where your
            <br className="desktop-only" /> best stories begin.
          </blockquote>
          <p>Your personal cooking notebook</p>
        </section>
      </main>
      <footer>
        <span>mise en place</span>
        <span>Your recipes stay yours.</span>
        <span>Local recipe storage</span>
      </footer>
      {formOpen && (
        <div className="modal-backdrop" onClick={() => setFormOpen(false)}>
          <aside
            className="recipe-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="close-button"
              onClick={() => setFormOpen(false)}
              aria-label="Close form"
            >
              ×
            </button>
            <p className="section-kicker">NEW RECIPE</p>
            <h2>Add to your table.</h2>
            <p className="panel-intro">
              Write it down while you remember every good detail.
            </p>
            <form onSubmit={submitRecipe}>
              <div className="form-grid">
                <label>
                  Recipe title
                  <input
                    required
                    value={form.title}
                    onChange={(event) =>
                      updateForm("title", event.target.value)
                    }
                  />
                </label>
                <label>
                  Category
                  <input
                    value={form.category}
                    onChange={(event) =>
                      updateForm("category", event.target.value)
                    }
                    placeholder="Dinner, baking..."
                  />
                </label>
                <label>
                  Cuisine
                  <input
                    value={form.cuisine}
                    onChange={(event) =>
                      updateForm("cuisine", event.target.value)
                    }
                  />
                </label>
                <label>
                  Difficulty
                  <select
                    value={form.difficulty}
                    onChange={(event) =>
                      updateForm("difficulty", event.target.value)
                    }
                  >
                    <option value="">Choose one</option>
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </label>
                <label>
                  Prep minutes
                  <input
                    type="number"
                    min="0"
                    value={form.preparationTime}
                    onChange={(event) =>
                      updateForm("preparationTime", event.target.value)
                    }
                  />
                </label>
                <label>
                  Cook minutes
                  <input
                    type="number"
                    min="0"
                    value={form.cookingTime}
                    onChange={(event) =>
                      updateForm("cookingTime", event.target.value)
                    }
                  />
                </label>
                <label>
                  Servings
                  <input
                    type="number"
                    min="1"
                    value={form.servings}
                    onChange={(event) =>
                      updateForm("servings", event.target.value)
                    }
                  />
                </label>
                <label>
                  Cover image URL
                  <input
                    type="url"
                    value={form.coverImage}
                    onChange={(event) =>
                      updateForm("coverImage", event.target.value)
                    }
                  />
                </label>
              </div>
              <label>
                Description
                <textarea
                  rows="3"
                  value={form.description}
                  onChange={(event) =>
                    updateForm("description", event.target.value)
                  }
                />
              </label>
                <button
                  type="button"
                  className={`voice-button form-voice ${listeningField === "recipe-description" ? "listening" : ""}`}
                  onClick={() => startDictation("recipe-description", form.description, (value) => updateForm("description", value))}
                >
                  {listeningField === "recipe-description" ? "Listening... tap to stop" : "Dictate description"}
                </button>
                {voiceStatus && <p className="diary-status" role="status">{voiceStatus}</p>}
              <div className="dynamic-section">
                <div className="form-section-heading">
                  <strong>Ingredients</strong>
                  <button
                    type="button"
                    onClick={() => addArrayItem("ingredients", emptyIngredient)}
                  >
                    + Add ingredient
                  </button>
                </div>
                {form.ingredients.map((ingredient, index) => (
                  <div className="dynamic-row" key={index}>
                    <input
                      placeholder="Ingredient"
                      value={ingredient.name}
                      onChange={(event) =>
                        updateArrayItem(
                          "ingredients",
                          index,
                          "name",
                          event.target.value,
                        )
                      }
                    />
                    <button type="button" className={`voice-button ingredient-voice ${listeningField === `ingredient-${index}` ? "listening" : ""}`} onClick={() => startDictation(`ingredient-${index}`, ingredient.name, (value) => updateArrayItem("ingredients", index, "name", value))} aria-label="Dictate ingredient name">
                      {listeningField === `ingredient-${index}` ? "Stop" : "Voice"}
                    </button>
                    <input
                      placeholder="Quantity"
                      value={ingredient.quantity}
                      onChange={(event) =>
                        updateArrayItem(
                          "ingredients",
                          index,
                          "quantity",
                          event.target.value,
                        )
                      }
                    />
                    <input
                      placeholder="Unit"
                      value={ingredient.unit}
                      onChange={(event) =>
                        updateArrayItem(
                          "ingredients",
                          index,
                          "unit",
                          event.target.value,
                        )
                      }
                    />
                    {form.ingredients.length > 1 && (
                      <button
                        type="button"
                        className="remove-row"
                        onClick={() => removeArrayItem("ingredients", index)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="dynamic-section">
                <div className="form-section-heading">
                  <strong>Cooking steps</strong>
                  <button
                    type="button"
                    onClick={() => addArrayItem("steps", emptyStep)}
                  >
                    + Add step
                  </button>
                </div>
                {form.steps.map((step, index) => (
                  <div className="step-row" key={index}>
                    <span>{index + 1}</span>
                    <textarea
                      rows="2"
                      placeholder="Describe this step..."
                      value={step.description}
                      onChange={(event) =>
                        updateArrayItem(
                          "steps",
                          index,
                          "description",
                          event.target.value,
                        )
                      }
                    />
                    <button type="button" className={`voice-button step-voice ${listeningField === `step-${index}` ? "listening" : ""}`} onClick={() => startDictation(`step-${index}`, step.description, (value) => updateArrayItem("steps", index, "description", value))} aria-label={`Dictate step ${index + 1}`}>
                      {listeningField === `step-${index}` ? "Stop" : "Voice"}
                    </button>
                    <input
                      type="number"
                      min="0"
                      placeholder="Timer"
                      value={step.timer}
                      onChange={(event) =>
                        updateArrayItem(
                          "steps",
                          index,
                          "timer",
                          event.target.value,
                        )
                      }
                    />
                    {form.steps.length > 1 && (
                      <button
                        type="button"
                        className="remove-row"
                        onClick={() => removeArrayItem("steps", index)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <label>
                Tags <span className="field-hint">comma separated</span>
                <input
                  value={form.tags}
                  onChange={(event) => updateForm("tags", event.target.value)}
                  placeholder="family favorite, weekend..."
                />
              </label>
              <button className="primary-button submit-button" type="submit">
                Save recipe <span>→</span>
              </button>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}

export default App;
