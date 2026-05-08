# GitTidy Mini PRD

**Project name:** GitTidy  
**Owner:** Los / Carlos Franzetti  
**Date:** May 8, 2026  

## Problem statement

Student developers and indie builders often create strong projects but present them poorly on GitHub. Repositories frequently have missing READMEs, vague descriptions, no deployment links, inconsistent topics, and little documentation. This happens because developers focus on building features instead of polishing presentation, resulting in lower engagement, fewer collaborators, weaker portfolios, and projects that are difficult for recruiters, classmates, or users to understand quickly.

## Users and needs

**Primary user(s):**  
Students, beginner developers, indie hackers, hackathon participants, and creative coders who use GitHub to showcase projects.

Key user needs:

- As a student developer, I need to improve my README quickly because I do not want to spend hours writing documentation.
- As a portfolio builder, I need my repositories to look polished because recruiters and peers judge projects visually within seconds.
- As a beginner developer, I need help identifying missing repo information because I often forget descriptions, topics, and deployment links.
- As a creative coder, I need simple AI-powered suggestions because documentation feels repetitive and difficult to structure.
- As a hackathon participant, I need to clean up repos fast before demos or submissions.

## Proposed solution

GitTidy is a lightweight web application that helps developers clean up and improve their GitHub repositories. Users enter their GitHub username and select a repository, and the app automatically analyzes repo quality including README completeness, descriptions, topics, and deployment links.

GitTidy uses AI through OpenRouter to generate an improved README, suggest better descriptions and topics, and recommend adding deployment links when missing. Users can preview and copy the generated content directly into GitHub.

As a result, developers can make their projects look more professional in minutes without needing advanced writing or branding skills.

## Value proposition

Students and indie developers who struggle with weak GitHub presentation use GitTidy, an AI-powered repository cleanup tool, to quickly improve READMEs, descriptions, and overall repo quality. Unlike manually rewriting documentation or using generic templates, GitTidy analyzes the actual repository and generates targeted improvements, helping projects look polished, understandable, and portfolio-ready in minutes.

## Requirements

| Requirement | Priority |
| :---- | :---- |
| User can enter a GitHub username | MVP |
| User can optionally enter a GitHub Personal Access Token | MVP |
| User can load and browse repositories from GitHub | MVP |
| User can select a repository for analysis | MVP |
| User can view repository details including description, language, stars, and homepage | MVP |
| User can fetch and preview the current README | MVP |
| User can receive a GitTidy quality score for a repository | MVP |
| User can identify missing repo elements such as deployment links or topics | MVP |
| User can generate an AI-improved README | MVP |
| User can generate improved repo descriptions and suggested topics | MVP |
| User can copy generated README markdown | MVP |
| User can view deploy suggestions when homepage links are missing | MVP |
| User can push README and metadata updates directly to GitHub | + |
| User can authenticate with GitHub OAuth instead of manual token entry | + |
| User can compare before-and-after repo quality scores | + |
| User can batch-analyze multiple repositories | + |
| User can choose different README writing styles or themes | + |
