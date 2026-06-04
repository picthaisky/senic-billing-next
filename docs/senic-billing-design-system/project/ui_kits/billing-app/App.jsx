// App — root state machine: auth + theme + page routing
const { useState: useState_, useEffect: useEffect_ } = React;
const DOC_TYPES = ['receipt', 'cashbill', 'delivery', 'taxinvoice'];

function App() {
  const [authed, setAuthed] = useState_(false);
  const [page, setPage] = useState_('dashboard');
  const [collapsed, setCollapsed] = useState_(false);
  const [theme, setTheme] = useState_(() => localStorage.getItem('senic-theme') || 'warm-horizon');

  useEffect_(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('senic-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'warm-horizon' ? 'deep-ocean' : 'warm-horizon');

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  let body;
  if (page === 'dashboard') body = <Dashboard theme={theme} />;
  else if (DOC_TYPES.includes(page)) body = <DocumentForm type={page} key={page} />;
  else if (page === 'customers' || page === 'products') body = <DataPage type={page} key={page} />;
  else if (page === 'settings') body = <SettingsPage />;
  else body = <Dashboard theme={theme} />;

  return (
    <div className="app">
      <Sidebar page={page} onNav={setPage} collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="main">
        <Header page={page} theme={theme} onToggleTheme={toggleTheme} onNav={setPage} onLogout={() => { setAuthed(false); setPage('dashboard'); }} />
        <div className="content"><div key={page} className="animate-fade-in">{body}</div></div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
