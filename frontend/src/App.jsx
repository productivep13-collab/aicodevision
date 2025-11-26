// frontend/src/App.js
import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import './App.css';

const API_BASE = 'https://video-compilation-backend.onrender.com';

const sampleData = {
  repo: 'demo/sample-repo',
  branch: 'main',
  tree: [
    { path: 'index.html', type: 'blob' },
    { path: 'src/app.js', type: 'blob' },
    { path: 'src/utils/helpers.js', type: 'blob' },
    { path: 'src/components/Button.jsx', type: 'blob' },
    { path: 'README.md', type: 'blob' },
    { path: 'package.json', type: 'blob' },
    { path: 'docs/guide.md', type: 'blob' },
  ],
};

function setSummariesToDemo(node) {
  if (node.isFile) {
    node.summary = `Demo summary for ${node.path}: This file contains sample code.`;
  } else {
    node.children.forEach(setSummariesToDemo);
  }
}

function App() {
  const [repoUrl, setRepoUrl] = useState('https://github.com/octocat/Hello-World');
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState('Ready.');
  const [currentTree, setCurrentTree] = useState(null);
  const [repoName, setRepoName] = useState('—');
  const [fileCount, setFileCount] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [summariesStr, setSummariesStr] = useState('');
  const graphRef = useRef(null);
  const chatRef = useRef(null);

  useEffect(() => {
    visualize(repoUrl);
  }, []);

  useEffect(() => {
    if (currentTree) renderGraph(currentTree);
  }, [currentTree]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages]);

  const visualize = async (url) => {
    setStatus('Parsing URL...');
    try {
      const response = await fetch(`${API_BASE}/api/repo?url=${encodeURIComponent(url)}`);
      if (!response.ok) throw new Error('Backend error');
      const data = await response.json();
      setRepoName(data.repo);
      setFileCount(data.fileCount);
      setCurrentTree(data.tree);
      setSummariesStr(data.summaries);
      initChatHistory(data.tree, data.summaries);
      filterTree(searchQuery, data.tree);
      setStatus('Done. Hover nodes for summaries, ask chatbot for insights.');
    } catch (e) {
      console.warn('Fetch repo failed, using demo.', e);
      setStatus('Fetch error - using demo');
      const root = buildHierarchy(sampleData.tree);
      setSummariesToDemo(root);
      sortTree(root);
      const summaries = collectSummaries(root);
      setRepoName(sampleData.repo);
      setFileCount(sampleData.tree.length);
      setCurrentTree(root);
      setSummariesStr(summaries);
      initChatHistory(root, summaries);
      filterTree(searchQuery, root);
    }
  };

  const buildHierarchy = (items) => {
    const root = { name: '/', children: [], path: '' };
    items.forEach((item) => {
      const parts = item.path.split('/');
      let node = root;
      parts.forEach((p, idx) => {
        let child = node.children.find((c) => c.name === p);
        if (!child) {
          child = { name: p, children: [], path: node.path ? `${node.path}/${p}` : p, isFile: idx === parts.length - 1 && item.type === 'blob' };
          node.children.push(child);
        }
        node = child;
      });
    });
    return root;
  };

  const sortTree = (node) => {
    if (node.children) {
      node.children.sort((a, b) => a.name.localeCompare(b.name));
      node.children.forEach(sortTree);
    }
  };

  const collectSummaries = (node) => {
    let summaries = [];
    const traverse = (n) => {
      if (n.isFile) summaries.push(`File: ${n.path}\nSummary: ${n.summary || 'N/A'}\n`);
      if (n.children) n.children.forEach(traverse);
    };
    traverse(node);
    return summaries.join('\n');
  };

  const initChatHistory = (tree, summaries) => {
    const treeStr = JSON.stringify(tree, ['name', 'path', 'isFile', 'children'], 2);
    const systemPrompt = {
      role: 'system',
      content: `You are a helpful codebase analyst. Repository structure: ${treeStr}\nFile summaries:\n${summaries}\nAnswer questions using the provided info.`,
    };
    setChatHistory([systemPrompt]);
    setChatMessages([{ role: 'ai', content: 'Hello! Ask me anything about this codebase.' }]);
  };

  const filterHierarchy = (node, query) => {
    const lowerQuery = query.toLowerCase();
    if (node.isFile) return node.name.toLowerCase().includes(lowerQuery) ? { ...node } : null;
    const filteredChildren = (node.children || []).map((c) => filterHierarchy(c, query)).filter(Boolean);
    if (filteredChildren.length > 0 || node.name.toLowerCase().includes(lowerQuery)) {
      return { ...node, children: filteredChildren };
    }
    return null;
  };

  const filterTree = (query, tree = currentTree) => {
    if (!tree) return;
    const filteredRoot = query ? filterHierarchy(tree, query) : tree;
    if (filteredRoot) {
      renderFileTree(filteredRoot);
      setCurrentTree(filteredRoot);
    } else {
      document.getElementById('fileTree').innerHTML = '<div class="small">No matches found.</div>';
      renderGraph({ name: '/', children: [] });
    }
  };

  const renderFileTree = (root) => {
    const fileTree = document.getElementById('fileTree');
    if (!fileTree) return;
    fileTree.innerHTML = '';
    const createList = (nodes, container) => {
      nodes.forEach((n) => {
        const row = document.createElement('div');
        row.className = n.isFile ? 'file' : 'folder';
        const label = document.createElement('div');
        label.className = 'label';
        label.textContent = n.name;
        row.appendChild(label);
        if (n.isFile) {
          const ext = document.createElement('div');
          ext.className = 'ext';
          ext.textContent = n.name.split('.').pop();
          row.appendChild(ext);
          row.addEventListener('click', (ev) => {
            ev.stopPropagation();
            setChatHistory((prev) => [
              ...prev,
              { role: 'system', content: `User selected file: ${n.path}\nSummary: ${n.summary || 'N/A'}` },
            ]);
            setChatMessages((prev) => [...prev, { role: 'system', content: `Selected file: ${n.path}. You can now ask about it.` }]);
          });
        } else {
          row.addEventListener('click', (ev) => {
            ev.stopPropagation();
            row.classList.toggle('open');
            const next = row.nextElementSibling;
            if (next) next.classList.toggle('hidden');
          });
        }
        container.appendChild(row);
        if (!n.isFile) {
          const sub = document.createElement('div');
          sub.style.paddingLeft = '12px';
          sub.className = 'hidden';
          createList(n.children || [], sub);
          container.appendChild(sub);
        }
      });
    };
    createList(root.children || [], fileTree);
  };

  const renderGraph = (root) => {
    const graphEl = graphRef.current;
    if (!graphEl) return;
    graphEl.innerHTML = '';
    const width = graphEl.clientWidth || 800;
    const height = graphEl.clientHeight || 500;
    const svg = d3.select(graphEl).append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('overflow', 'visible');

    const hierarchy = d3.hierarchy(root, (d) => d.children);
    const treeLayout = d3.tree().size([Math.max(300, height - 120), Math.max(600, width - 200)]);
    const treeData = treeLayout(hierarchy);

    const g = svg.append('g').attr('transform', `translate(40,40)`);

    g.selectAll('path.link')
      .data(treeData.links())
      .join('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.08)')
      .attr('stroke-width', 1.2)
      .attr('d', d3.linkHorizontal().x((d) => d.y).y((d) => d.x));

    const node = g.selectAll('g.node')
      .data(treeData.descendants())
      .join('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.y},${d.x})`);

    node.append('foreignObject')
      .attr('width', 220)
      .attr('height', 70)
      .attr('x', -10)
      .attr('y', -35)
      .append('xhtml:div')
      .style('background', '#071226')
      .style('border', '1px solid rgba(255,255,255,0.04)')
      .style('border-radius', '8px')
      .style('padding', '8px')
      .style('width', '200px')
      .style('height', '56px')
      .style('overflow', 'hidden')
      .html((d) => {
        const name = d.data.name || '';
        const kind = d.data.isFile ? 'File' : 'Folder';
        const summ = d.data.summary ? (d.data.summary.length > 120 ? d.data.summary.slice(0, 120) + '...' : d.data.summary) : '';
        return `<strong style="color:#7c3aed">${name}</strong><div style="font-size:12px;color:#94a3b8">${kind}</div><div style="font-size:11px;color:#cfe6ff;margin-top:4px">${summ}</div>`;
      });

    svg.call(d3.zoom().scaleExtent([0.2, 2.5]).on('zoom', (event) => {
      g.attr('transform', event.transform);
    }));

    node.on('click', (event, d) => {
      if (d.data.summary) {
        const overlay = document.createElement('div');
        overlay.className = 'summary-overlay';
        overlay.innerHTML = `<div class="overlay-card"><h3>${d.data.path || d.data.name}</h3><pre style="white-space:pre-wrap;">${d.data.summary}</pre><button id="closeOverlay">Close</button></div>`;
        document.body.appendChild(overlay);
        document.getElementById('closeOverlay').onclick = () => overlay.remove();
      }
    });
  };

  const sendChatMessage = async () => {
    const userMsg = chatInput.trim();
    if (!userMsg) return;
    setChatMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    let currentHistory = chatHistory.slice();
    currentHistory.push({ role: 'user', content: userMsg });
    setChatMessages((prev) => [...prev, { role: 'ai', content: 'Thinking...' }]);
    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: currentHistory }),
      });
      if (!response.ok) throw new Error('Chat API error');
      const data = await response.json();
      setChatMessages((prev) => {
        const withoutThinking = prev.slice(0, -1);
        return [...withoutThinking, { role: 'ai', content: data.content }];
      });
      setChatHistory((prev) => [...prev, { role: 'user', content: userMsg }, { role: 'assistant', content: data.content }]);
    } catch (err) {
      console.error(err);
      setChatMessages((prev) => {
        const withoutThinking = prev.slice(0, -1);
        return [...withoutThinking, { role: 'ai', content: 'Error generating response' }];
      });
    }
  };

  const generateAISummary = async () => {
    if (!currentTree) return;
    setStatus('Generating summary...');
    try {
      const response = await fetch(`${API_BASE}/api/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tree: currentTree, summaries: summariesStr }),
      });
      if (!response.ok) throw new Error('Summary API error');
      const data = await response.json();
      const div = document.createElement('div');
      div.style.position = 'fixed';
      div.style.top = '12%';
      div.style.left = '12%';
      div.style.width = '76%';
      div.style.height = '72%';
      div.style.background = 'var(--card)';
      div.style.padding = '20px';
      div.style.overflow = 'auto';
      div.style.zIndex = '9999';
      div.style.borderRadius = '12px';
      div.style.border = '1px solid rgba(255,255,255,0.05)';
      div.innerHTML = `<h2>AI Repository Summary</h2><pre style="white-space:pre-wrap;">${data.content}</pre><button id="closeSummary">Close</button>`;
      document.body.appendChild(div);
      document.getElementById('closeSummary').onclick = () => div.remove();
    } catch (err) {
      alert('Error generating summary');
      console.error(err);
    }
    setStatus('Ready.');
  };

  return (
    <div>
      <header>
        <h1>GitHub Repo Visualizer — SaaS Pro</h1>
        <p>Paste a GitHub repo URL, hit Visualize. AI summaries + chatbot integrated.</p>
      </header>
      <div className="container">
        <div className="sidebar">
          <div className="controls">
            <input
              type="text"
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
            <button onClick={() => visualize(repoUrl)}>Visualize</button>
          </div>
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              filterTree(e.target.value);
            }}
            style={{ margin: '8px' }}
          />
          <div id="status" className="status">{status}</div>
          <div className="tree" id="fileTree"></div>
        </div>
        <div className="main">
          <div className="meta">
            <div className="small">Repository: {repoName}</div>
            <div className="small">Files: {fileCount}</div>
            <button onClick={generateAISummary}>Generate AI Summary</button>
          </div>
          <div className="graph-container">
            <div ref={graphRef} id="graph" style={{ minHeight: 360 }}></div>
          </div>
          <div className="chat-container">
            <div ref={chatRef} id="chatMessages">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    marginBottom: '8px',
                    padding: '6px',
                    borderRadius: '6px',
                    background: msg.role === 'user' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                  }}
                >
                  <strong>{msg.role === 'user' ? 'You' : msg.role === 'system' ? 'System' : 'AI'}:</strong>{' '}
                  <span dangerouslySetInnerHTML={{ __html: (msg.content || '').replace(/\n/g, '<br/>') }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, padding: 8 }}>
              <input
                placeholder="Ask about codebase..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                style={{ flex: 1 }}
              />
              <button onClick={sendChatMessage}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
