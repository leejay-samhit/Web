export default function Spinner({ size = 28 }) {
  return (
    <div className="flex items-center justify-center p-6" data-testid="spinner">
      <div
        className="rounded-full border-4 border-[color:var(--sc-primary)] border-r-transparent animate-spin"
        style={{ width: size, height: size }}
      />
    </div>
  );
}
