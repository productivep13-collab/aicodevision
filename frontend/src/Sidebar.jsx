import React, { useState } from "react";

export default function Sidebar({ visualizeRepo, status, repoData }) {
  const [url, setUrl] = useState("https://github.com/octocat/Hello-World");

  return (
    <div className="sidebar">
      <div className="controls">
        <input value={url} onChange={(e) => setUrl(e.target.value)} />
        <button onClick={() => visualizeRepo(url)}>Visualize</button>
      </div>
      <div className="status">{status}</div>
      <div className="tree">
        {repoData &&
          repoData.tree.map((file) => (
            <div key={file.path}>{file.path}</div>
          ))}
      </div>
    </div>
  );
}
