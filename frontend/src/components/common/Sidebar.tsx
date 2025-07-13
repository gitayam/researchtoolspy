import React from 'react';
import { Link } from 'react-router-dom';

const Sidebar: React.FC = () => {
  return (
    <aside style={{ width: '200px', padding: '20px', backgroundColor: '#f8f8f8', borderRight: '1px solid #ccc' }}>
      <nav>
        <ul>
          <li><Link to="/">Home</Link></li>
          <li><Link to="/frameworks">Frameworks</Link></li>
          <li><Link to="/transformers">Transformers</Link></li>
          <li><Link to="/tools">Tools</Link></li>
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
