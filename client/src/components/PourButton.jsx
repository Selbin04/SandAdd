export default function PourButton({
  pouring,
  disabled,
  onPress,
  onRelease,
  onReset,
}) {
  return (
    <div className="pour-col">
      <div className="pipe" aria-hidden="true">
        <span className="pipe-joint" />
        <span className="pipe-run" />
        <span className="pipe-joint" />
      </div>

      <button
        type="button"
        className={`pour-btn ${pouring ? "is-down" : ""}`}
        disabled={disabled}
        aria-pressed={pouring}
        aria-label="Hold to pour sand"
        onPointerDown={(e) => {
          if (disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          onPress();
        }}
        onPointerUp={onRelease}
        onPointerCancel={onRelease}
        onLostPointerCapture={onRelease}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="pour-btn-rim" />
        <span className="pour-btn-face">
          <span className="pour-btn-label">POUR</span>
          <span className="pour-btn-hint">{disabled ? "empty" : "hold"}</span>
        </span>
      </button>

      <button type="button" className="reset" onClick={onReset}>
        Reset this project
      </button>

      <p className="pour-caption">
        Sand falls only while
        <br />
        this button is held
      </p>
    </div>
  );
}
