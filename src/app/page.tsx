const board = [
  ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"],
  ["♟", "♟", "♟", "", "♟", "♟", "♟", "♟"],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "♟", "", "", "", ""],
  ["", "", "", "", "♙", "", "", ""],
  ["", "", "", "", "", "♘", "", ""],
  ["♙", "♙", "♙", "♙", "", "♙", "♙", "♙"],
  ["♖", "♘", "♗", "♕", "♔", "♗", "", "♖"],
];

const foundations = [
  {
    number: "01",
    title: "Shape the board",
    description: "Resize the field, remove cells, and arrange a starting position that changes the opening question.",
  },
  {
    number: "02",
    title: "Invent the pieces",
    description: "Compose movement, capture, and abilities into pieces that have never existed on a chessboard.",
  },
  {
    number: "03",
    title: "Write the objective",
    description: "Checkmate a king, hold territory, escort a piece, or define a completely different finish line.",
  },
  {
    number: "04",
    title: "Play and remix",
    description: "Test instantly, invite a friend, then publish a version the community can discover and build upon.",
  },
];

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

export default function Home() {
  return (
    <main>
      <a className="skip-link" href="#content">
        Skip to content
      </a>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Rookery home">
          <span className="brand-mark" aria-hidden="true">♜</span>
          <span>Rookery</span>
        </a>

        <nav aria-label="Primary navigation">
          <a href="#create">Create</a>
          <a href="#foundation">Foundation</a>
          <a href="https://github.com/fawzmehfil/rookery">GitHub</a>
        </nav>

        <a className="header-action" href="#create">
          Enter the workshop
          <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy" id="content">
          <p className="eyebrow"><span /> A chess variant workshop</p>
          <h1>Make the rules.<br /><em>Change the game.</em></h1>
          <p className="hero-intro">
            Rookery is a place to create unusual boards, teach new pieces how to move,
            and turn a wild idea into a game anyone can play.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#create">See the vision <span>→</span></a>
            <a className="button button-quiet" href="/api/health">System status <span className="status-dot" /></a>
          </div>
          <p className="build-note">Foundation build · Editor coming next</p>
        </div>

        <div className="workbench" aria-label="Preview of the Rookery variant editor">
          <div className="workbench-bar">
            <div className="window-dots" aria-hidden="true"><span /><span /><span /></div>
            <span className="file-name">untitled-variant.rky</span>
            <span className="saved-state">Draft preview</span>
          </div>

          <div className="workbench-body">
            <aside className="tool-rail" aria-label="Editor tools preview">
              <span className="active-tool">✦</span>
              <span>♙</span>
              <span>↝</span>
              <span>◎</span>
              <span className="tool-spacer" />
              <span>?</span>
            </aside>

            <div className="board-stage">
              <div className="board-heading">
                <div>
                  <span className="micro-label">Board editor</span>
                  <strong>First Flight</strong>
                </div>
                <span className="draft-pill">Draft</span>
              </div>

              <div className="board-wrap">
                <div className="rank-labels" aria-hidden="true">
                  {[8, 7, 6, 5, 4, 3, 2, 1].map((rank) => <span key={rank}>{rank}</span>)}
                </div>
                <div className="chess-board" role="img" aria-label="A customized chess position on an eight by eight board">
                  {board.flatMap((rank, rankIndex) =>
                    rank.map((piece, fileIndex) => (
                      <span
                        className={`${(rankIndex + fileIndex) % 2 === 0 ? "light" : "dark"} ${piece ? "occupied" : ""}`}
                        key={`${rankIndex}-${fileIndex}`}
                      >
                        {piece}
                      </span>
                    )),
                  )}
                </div>
                <div className="file-labels" aria-hidden="true">
                  {files.map((file) => <span key={file}>{file}</span>)}
                </div>
              </div>
            </div>

            <aside className="inspector">
              <span className="micro-label">Inspector</span>
              <div className="inspector-section">
                <strong>Board</strong>
                <div className="field-row"><span>Columns</span><b>8</b></div>
                <div className="field-row"><span>Rows</span><b>8</b></div>
              </div>
              <div className="inspector-section">
                <strong>Win condition</strong>
                <div className="select-mock">Capture the royal <span>⌄</span></div>
              </div>
              <div className="inspector-section rules">
                <strong>Active rules</strong>
                <span><i /> Royal safety</span>
                <span><i /> Promotion</span>
                <span><i className="off" /> Castling</span>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="manifesto" id="create">
        <p className="section-label">From familiar to impossible</p>
        <p className="manifesto-copy">
          Chess is a language. <span>Rookery gives everyone a way to write in it.</span>
        </p>
      </section>

      <section className="foundation" id="foundation">
        <div className="section-heading">
          <div>
            <p className="section-label">The creative loop</p>
            <h2>Built for tinkering.</h2>
          </div>
          <p>Move from a sketch to a playable link without code, installs, or rulebook archaeology.</p>
        </div>

        <div className="foundation-grid">
          {foundations.map((item) => (
            <article key={item.number}>
              <span className="card-number">{item.number}</span>
              <div className={`card-symbol symbol-${item.number}`} aria-hidden="true">
                {item.number === "01" && <><i /><i /><i /><i /></>}
                {item.number === "02" && <span>♞</span>}
                {item.number === "03" && <><span className="target-ring" /><span className="target-dot" /></>}
                {item.number === "04" && <><span>R</span><b>↗</b></>}
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="closing">
        <div>
          <p className="eyebrow"><span /> Open from the first move</p>
          <h2>The board is only<br />the beginning.</h2>
        </div>
        <div className="closing-copy">
          <p>This first build establishes the canvas. The next one makes it playable.</p>
          <a className="button button-primary" href="https://github.com/fawzmehfil/rookery">Follow the build <span>→</span></a>
        </div>
      </section>

      <footer>
        <a className="brand" href="#top"><span className="brand-mark" aria-hidden="true">♜</span><span>Rookery</span></a>
        <p>Make something worth playing twice.</p>
        <span>© {new Date().getFullYear()} Rookery</span>
      </footer>
    </main>
  );
}
