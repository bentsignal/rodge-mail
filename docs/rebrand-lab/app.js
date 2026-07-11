const concepts = {
  dispatch: {
    number: "Direction 01",
    title: "Dispatch",
    thesis:
      "Mail as an operations desk: fast, legible, compact, and made for keyboard flow.",
    facts: [
      ["Navigation", "Account dock + command rail"],
      ["Density", "Compact, scannable rows"],
      ["Mobile", "Queue first, actions at thumb reach"],
    ],
  },
  correspondence: {
    number: "Direction 02",
    title: "Correspondence",
    thesis:
      "Mail as a reading practice: quiet hierarchy, generous typography, and a deliberate sense of place.",
    facts: [
      ["Navigation", "Top library nav + account index"],
      ["Density", "Editorial rhythm, generous reader"],
      ["Mobile", "Morning brief above a letter index"],
    ],
  },
  frequency: {
    number: "Direction 03",
    title: "Frequency",
    thesis:
      "Mail as a live communications instrument: temporal, high contrast, and unapologetically dark-first.",
    facts: [
      ["Navigation", "Channel board + live signal filters"],
      ["Density", "High-information, status-rich stream"],
      ["Mobile", "Live feed with channel tuner"],
    ],
  },
  orbit: {
    number: "Direction 04",
    title: "Orbit",
    thesis:
      "Mail as a personal space: tactile account identities, calm card stacks, and a reader that floats above the feed.",
    facts: [
      ["Navigation", "Account orbit + spatial surfaces"],
      ["Density", "Relaxed, touchable message cards"],
      ["Mobile", "Floating native-style action dock"],
    ],
  },
};

let direction = "dispatch";
let mode = "light";

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.direction) {
    direction = button.dataset.direction;
    activateControl("direction", direction);
    document.querySelectorAll(".prototype").forEach((prototype) => {
      prototype.classList.toggle(
        "is-visible",
        prototype.dataset.concept === direction,
      );
    });
    renderConceptNotes();
  }

  if (button.dataset.mode) {
    mode = button.dataset.mode;
    activateControl("mode", mode);
    document.querySelectorAll(".prototype").forEach((prototype) => {
      prototype.dataset.mode = mode;
    });
  }

  if (button.dataset.viewport) {
    activateControl("viewport", button.dataset.viewport);
    document.querySelector(".stage").dataset.viewport = button.dataset.viewport;
  }
});

function activateControl(name, value) {
  document.querySelectorAll(`[data-${name}]`).forEach((button) => {
    button.classList.toggle("is-active", button.dataset[name] === value);
  });
}

function renderConceptNotes() {
  const concept = concepts[direction];
  document.querySelector("#concept-number").textContent = concept.number;
  document.querySelector("#concept-title").textContent = concept.title;
  document.querySelector("#concept-thesis").textContent = concept.thesis;
  document.querySelector("#concept-facts").innerHTML = concept.facts
    .map(
      ([term, description]) =>
        `<div><dt>${term}</dt><dd>${description}</dd></div>`,
    )
    .join("");
}
