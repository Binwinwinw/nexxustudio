function App() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8f8ff', color: '#6068f0' }}>
      <header className="border-b px-6 py-4" style={{ borderColor: '#6068f022' }}>
        <nav className="font-medium">Menu</nav>
      </header>
      <main>
        <section className="px-6 py-16 text-center">
          <h1 className="text-4xl font-bold mb-2">La Citadelle</h1>
          <h2 className="text-xl opacity-80 mb-8">Observer, transposer, corriger</h2>
        </section>
        <article className="mx-auto max-w-2xl rounded-2xl p-6 mb-12 shadow-sm" style={{ backgroundColor: '#ffffff' }}>
          <p className="mb-6">Design system local-first pour Nexxus Studio.</p>
          <a href="#forge" className="inline-block rounded-lg px-6 py-3 font-semibold text-white" style={{ backgroundColor: '#6068f0' }}>
            Découvrir Forge
          </a>
        </article>
      </main>
      <footer className="px-6 py-8 text-center text-sm opacity-60">© Nexxus Studio</footer>
    </div>
  );
}

export default App;
