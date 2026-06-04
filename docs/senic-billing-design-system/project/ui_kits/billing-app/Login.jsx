// Login — mirrors auth/LoginPage.tsx
function Login({ onLogin }) {
  const [user, setUser] = React.useState('admin');
  const [pass, setPass] = React.useState('demo1234');
  const [loading, setLoading] = React.useState(false);

  const submit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); onLogin(); }, 700);
  };

  return (
    <div className="login-screen">
      <div className="card login-card animate-fade-in-up">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="login-logo">S</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>
            Senic<span style={{ color: 'var(--color-primary)' }}>Billing</span>
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--color-text-muted)' }}>
            เข้าสู่ระบบเพื่อจัดการเอกสารของคุณ
          </p>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label className="field-label">ชื่อผู้ใช้งาน</label>
            <input className="input-field" value={user} onChange={(e) => setUser(e.target.value)} placeholder="admin" />
          </div>
          <div>
            <label className="field-label">รหัสผ่าน</label>
            <input className="input-field" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 4 }} disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 20 }}>
          เดโม — กดปุ่มเพื่อเข้าสู่ระบบได้เลย
        </p>
      </div>
    </div>
  );
}
window.Login = Login;
