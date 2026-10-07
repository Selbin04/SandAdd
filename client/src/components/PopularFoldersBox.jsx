import { useState } from "react";
import "./PopularFoldersBox.css";

export const POPULAR_FOLDERS = [
  {
    id: "pop-tech",
    icon: "🚀",
    name: "Tech Placement Prep",
    category: "Coding & Interview",
    tasks: [
      { text: "Solve Array & String problems", hasCheckbox: true },
      { text: "System Design fundamentals", hasCheckbox: true },
      { text: "Mock technical interview practice", hasCheckbox: true },
      { text: "Resume & Portfolio project polish", hasCheckbox: true },
    ],
  },
  {
    id: "pop-design",
    icon: "🎨",
    name: "UI/UX Design System",
    category: "Design & Prototype",
    tasks: [
      { text: "Define design tokens & color palette", hasCheckbox: true },
      { text: "Set typography hierarchy & scale", hasCheckbox: true },
      { text: "Build UI component library variants", hasCheckbox: true },
      { text: "Test interactive prototype flows", hasCheckbox: true },
    ],
  },
  {
    id: "pop-dev",
    icon: "⚡",
    name: "Fullstack Web App Build",
    category: "Engineering",
    tasks: [
      { text: "Setup backend REST API routes", hasCheckbox: true },
      { text: "Database schema & ORM migrations", hasCheckbox: true },
      { text: "Develop responsive UI components", hasCheckbox: true },
      { text: "Deploy production build to Vercel", hasCheckbox: true },
    ],
  },
  {
    id: "pop-read",
    icon: "📚",
    name: "Daily Learning & Reading",
    category: "Knowledge & Habits",
    tasks: [
      { text: "Read 20 pages of technical book", hasCheckbox: true },
      { text: "Write code snippet notes & summary", hasCheckbox: true },
      { text: "Review key concepts & flashcards", hasCheckbox: true },
    ],
  },
  {
    id: "pop-write",
    icon: "✍️",
    name: "Content Creation & Writing",
    category: "Media & Publishing",
    tasks: [
      { text: "Draft technical article or blog post", hasCheckbox: true },
      { text: "Edit & polish newsletter issue", hasCheckbox: true },
      { text: "Design graphic cover asset", hasCheckbox: true },
    ],
  },
];

export default function PopularFoldersBox({
  onAddFolder,
  existingNames = [],
}) {
  const [addedIds, setAddedIds] = useState(new Set());
  const [addingId, setAddingId] = useState(null);

  const handleAdd = async (folder) => {
    if (addingId || addedIds.has(folder.id)) return;
    setAddingId(folder.id);
    try {
      await onAddFolder?.(folder);
      setAddedIds((prev) => new Set(prev).add(folder.id));
    } catch {
      /* ignore */
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="popular-folders-box" aria-label="Popular progress folders">
      <header className="popular-folders-head">
        <div className="popular-folders-title-wrap">
          <span className="popular-folders-badge">Popular</span>
          <h2>Folders You Should Try</h2>
        </div>
        <p className="popular-folders-hint">
          Featured progress paths ready to add to your workspace.
        </p>
      </header>

      <ul className="popular-folders-list">
        {POPULAR_FOLDERS.map((folder) => {
          const isAdded =
            addedIds.has(folder.id) ||
            existingNames.some(
              (n) => n && n.toLowerCase() === folder.name.toLowerCase()
            );
          const isBusy = addingId === folder.id;

          return (
            <li key={folder.id} className="popular-folder-item">
              <div className="popular-folder-main">
                <span className="popular-folder-icon" aria-hidden="true">
                  {folder.icon}
                </span>
                <div className="popular-folder-info">
                  <strong>{folder.name}</strong>
                  <span className="popular-folder-meta">
                    {folder.category} · {folder.tasks.length} tasks
                  </span>
                </div>
              </div>

              <button
                type="button"
                className={`popular-folder-add-btn ${isAdded ? "is-added" : ""}`}
                disabled={isAdded || isBusy}
                onClick={() => handleAdd(folder)}
                aria-label={`Add ${folder.name} progress folder`}
              >
                {isAdded ? "✓ Added" : isBusy ? "Adding…" : "+ Try folder"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
