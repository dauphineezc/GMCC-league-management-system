// Uses /api/me
export default function Dashboard() {
    return (
      <>
        <h1>League Management System</h1>
  
        <section className="card" style={{padding:24, marginBottom:24}}>
          <h2>Welcome</h2>
          <p>You’re signed in as <code>dev sign-in</code>.</p>
          <h3 style={{marginTop:16}}>My Teams</h3>
  
          <div style={{display:"grid", gap:16, gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", marginTop:12}}>
            {/* team cards will go here */}
          </div>
  
          <div style={{display:"flex", gap:12, marginTop:16}}>
            <button className="btn btn--primary">Create Team</button>
            <button className="btn">Join with Code</button>
            <button className="btn">Sign out</button>
          </div>
        </section>
      </>
    );
  }
  