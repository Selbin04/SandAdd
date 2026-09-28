import { useRef, useState } from "react";
import { PROOF_ACCEPT, fileToProof } from "../lib/socialFeed.js";
import ProofMedia from "./ProofMedia.jsx";
import "./TopicShareModal.css";

export default function TopicShareModal({ topic, onClose, onShare }) {
  const [proof, setProof] = useState(null);
  const [proofName, setProofName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const next = await fileToProof(file);
      setProof(next);
      setProofName(next?.name || "");
    } catch (err) {
      setProof(null);
      setProofName("");
      setError(err.message || "Could not attach proof");
    } finally {
      setBusy(false);
    }
  };

  const openShareTab = () => {
    setError("");
    onShare?.(proof || null);
  };

  return (
    <div className="topic-share-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="topic-share-card"
        role="dialog"
        aria-labelledby="topic-share-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="topic-share-title">Share progress?</h2>
        <p className="topic-share-copy">
          Share this progress. Proof is optional.
        </p>
        {topic?.text ? (
          <p className="topic-share-topic">
            Done: <strong>{topic.text}</strong>
          </p>
        ) : null}

        <input
          ref={fileRef}
          type="file"
          accept={PROOF_ACCEPT}
          hidden
          onChange={onFileChange}
        />

        {proofName ? (
          <>
            <p className="topic-share-file">{proofName}</p>
            <button
              type="button"
              className="topic-share-remove"
              disabled={busy}
              onClick={() => {
                setProof(null);
                setProofName("");
                setError("");
              }}
            >
              Remove proof
            </button>
          </>
        ) : (
          <p className="topic-share-file is-muted">
            Optional — image, video, or PDF
          </p>
        )}
        <ProofMedia proof={proof} className="topic-share-preview" />
        {error ? <p className="topic-share-error">{error}</p> : null}

        <div className="topic-share-actions">
          <button
            type="button"
            className="topic-share-attach"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {proofName ? "Change" : "Add proof"}
          </button>
          <button type="button" className="topic-share-close" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="topic-share-submit"
            disabled={busy}
            onClick={openShareTab}
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
