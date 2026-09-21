export function BackgroundLayer() {
  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          backgroundColor: 'var(--bg)',
          backgroundImage: 'var(--bg-image)',
          backgroundSize: 'cover',
          backgroundAttachment: 'fixed',
        }}
      />
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{ backgroundColor: 'var(--bg-overlay)' }}
      />
    </>
  )
}
