# Lessons Learned - Efficient GitHub Issue Creation for Google Projects

This document captures key lessons learned during the process of creating effective GitHub issues for Google projects, leveraging `gh` (GitHub CLI) and `git` commands. These insights will help streamline future issue reporting, ensure clarity, and improve overall project management for individual coders or small teams without being overly burdensome.

## Table of Contents

1. [GitHub Issue Formatting and Best Practices](#github-issue-formatting-and-best-practices)
2. [Defining the Problem/Opportunity and User Impact](#defining-the-problem-opportunity-and-user-impact)
3. [Leveraging `gh` CLI for Issue Management](#leveraging-gh-cli-for-issue-management)
4. [Effective Codebase Search for Issue Context](#effective-codebase-search-for-issue-context)
5. [Git Commands for Issue Context and Reproduction](#git-commands-for-issue-context-and-reproduction)
6. [Managing Labels and Milestones](#managing-labels-and-milestones)
7. [Standard Operating Procedures](#standard-operating-procedures)

## 1. GitHub Issue Formatting and Best Practices

### ❌ What Didn't Work

**Problem**: Vague or unstructured issue descriptions.

- "X feature is broken." / "We need X feature."
- No clear steps to reproduce (for bugs) or detailed requirements (for features).
- Missing environment details (for bugs) or justification (for features).

**Problem**: Long, unreadable blocks of text.

- Difficult to quickly grasp the core problem or proposed solution.
- Key information is buried.

### ✅ What Worked

**Solution**: Structured issue templates with clear sections.

- **Title**: Concise and descriptive (e.g., "BUG: [Component] Brief description of the problem," "FEAT: [Component] Implement new user profile page," "ENH: [Service] Improve API response time").
- **Description**: Follow a consistent format adapted to the issue type:

  - **For Bugs**: "Problem Statement," "Steps to Reproduce," "Expected Behavior," "Actual Behavior," "Environment," "Screenshots/Logs."
  - **For Features/Enhancements**: "Problem/Opportunity," "Proposed Solution/Requirements," "User Stories," "Acceptance Criteria," "Technical Considerations," "Dependencies," "Screenshots/Mocks."
- **Markdown for readability**:

  - Use headings (`#`, `##`, `###`) for sections.
  - Use bullet points (`-` or `*`) for lists.
  - Use code blocks (```) for code snippets, error messages, requirements, and logs.
  - Use bold (`**text**`) for emphasis.

Example Bug Report:
```markdown
# BUG: [Auth Service] User login fails with "Invalid Credentials" on retry

## Problem Statement

After an initial failed login attempt due to incorrect password, subsequent attempts with the correct password also fail, displaying "Invalid Credentials."

## Steps to Reproduce

1. Navigate to the login page: `https://example.com/login`
2. Enter username `testuser` and an incorrect password `wrongpass`. Click "Login."
3. Observe the "Invalid Credentials" error.
4. Enter username `testuser` and the correct password `correctpass`. Click "Login."
5. Observe that the "Invalid Credentials" error persists, and the user cannot log in.

## Expected Behavior

After an incorrect login attempt, entering the correct credentials should allow the user to log in successfully.

## Actual Behavior

The "Invalid Credentials" error becomes sticky after an initial incorrect login, preventing successful login even with correct credentials.

## Environment

- **Browser**: Chrome 125.0.6422.112
- **Operating System**: macOS Sonoma 14.4.1
- **Backend Version**: `v1.2.3` (from `/api/version` endpoint)
- **Frontend Build ID**: `frontend-build-12345`

## Screenshots/Logs

```
[2025-05-26 23:30:15] ERROR [AuthService] Login failed for user 'testuser': Invalid credentials
[2025-05-26 23:30:20] ERROR [AuthService] Login failed for user 'testuser': Stale authentication attempt
```
```

Example Feature Request:
```markdown
# FEAT: [Dashboard] Implement user activity feed

## Problem/Opportunity

Users currently have no way to see a quick overview of recent actions within the community dashboard (e.g., new messages, joined rooms, file uploads). This limits their ability to stay informed and engaged. An activity feed would enhance user experience and foster a more active community.

## Proposed Solution/Requirements

Implement a scrollable "Activity Feed" component on the main dashboard page.

- Display recent actions: new messages (top 5 from joined rooms), new room joins, file uploads.
- Each activity item should show user, action, and timestamp.
- Clicking on a message activity should navigate to the respective room.
- Should update in real-time (or near real-time, e.g., every 30 seconds).

## User Stories

- As a community member, I want to see a summary of recent activities so I can quickly catch up on what's happening.
- As a moderator, I want to monitor recent activities across important rooms to identify trends or issues.

## Acceptance Criteria

- Activity feed component renders on the dashboard.
- Displays at least three types of activities (messages, joins, uploads).
- Activities are ordered by timestamp (most recent first).
- Navigation to linked resources (e.g., room for a message) works correctly.
- Performance: Feed loads within 2 seconds on typical network conditions.

## Technical Considerations

- Requires new API endpoint `/api/activity` to fetch feed data.
- Needs WebSocket integration for real-time updates.
- Data aggregation strategy for high-volume activities.

## Dependencies

- Backend service update for `/api/activity` endpoint.
- UI library for activity feed component.

## Screenshots/Mocks

[Link to Figma/Excalidraw mockups for activity feed layout]
```

### 🔧 Standard Operating Procedure

1. **Always use a structured template** for new issues, adapting it to the issue type (bug, feature, enhancement).
2. **Prioritize clarity and conciseness** in the title and the core problem/solution statement.
3. **For bugs, provide exact steps to reproduce.** For features, provide detailed requirements.
4. **Include all relevant context**: environment details (for bugs), user stories, acceptance criteria, technical considerations, and dependencies (for features/enhancements).
5. **Attach screenshots/recordings (for bugs) or mocks/wireframes (for features)** for visual clarity.
6. **Paste relevant log snippets (for bugs) or code examples (for technical aspects of features)** using code blocks.
7. **Proofread** the issue before submitting.

## 2. Defining the Problem/Opportunity and User Impact

### ❌ What Didn't Work

**Problem**: Issues reported as technical problems or just "wants" without understanding their real-world effect or value.

- "Database connection failed." (What does this mean for a user?)
- "Add a new button." (Why is this button needed? What problem does it solve?)
- Missing context on how often a problem occurs, who is affected, or what value a feature brings.

### ✅ What Worked

**Solution**: Frame the issue from the user's perspective and quantify the impact or value.

- **Focus on the "Why"**: Instead of just "X is broken" or "We need X," explain "Because X is [broken/missing], users cannot do Y, leading to Z consequence/opportunity."
- **Quantify Impact (for bugs) or Value (for features/enhancements)**:

  - **For Bugs**:
    - "This affects ~15% of users attempting to register."
    - "Occurs intermittently, roughly 3-5 times a day, primarily during peak hours."
    - "Prevents critical reports from being generated, impacting weekly financial reconciliation."
  - **For Features/Enhancements**:
    - "Expected to increase user engagement by 20%."
    - "Will save support staff ~2 hours/day by automating manual data retrieval."
    - "Enables compliance with upcoming GDPR regulations."
- **Severity vs. Priority**:

  - **Severity (primarily for bugs)**: How bad is the bug *in itself*? (e.g., "Critical" if data loss occurs, "Minor" for a UI glitch).
  - **Priority (for all issue types)**: How important is it to fix/implement *now*? (e.g., "P0" if blocking all users/critical business flow, "P3" for a low-impact enhancement). A high severity bug might be low priority if it only affects a very niche, non-critical workflow. A valuable feature might be low priority if other, more critical work is ongoing.
- **User Stories**: Consider framing the problem or solution as a user story. "As a [type of user], I want to [action], so that [benefit/outcome]."

Example Bug Report with Impact:
```markdown
# BUG: [Checkout] Users cannot complete purchases (P0)

## Problem Statement

Users are unable to finalize their purchases. After clicking "Complete Order" on the checkout page, the page hangs indefinitely, and no order confirmation is received. This directly impacts revenue and user satisfaction.

## User Impact

- **Affected Users**: All users attempting to make a purchase. This is a complete blocker for the core functionality of the e-commerce site.
- **Frequency**: 100% reproducible.
- **Business Impact**: Direct loss of sales, negative user experience, potential reputational damage.
```

Example Feature Request with Value:
```markdown
# FEAT: [Analytics] Implement user journey tracking (P1)

## Problem/Opportunity

We currently lack detailed insight into how users navigate our application, specifically key conversion funnels (e.g., sign-up, content consumption, purchase). This data is crucial for identifying friction points and optimizing user experience.

## User Impact/Value

- **Impacted Stakeholders**: Product Managers, Marketing, UX Designers, Developers.
- **Value Proposition**: Enables data-driven decisions to improve user engagement and conversion rates. We estimate this could increase sign-ups by 5-10% and improve feature adoption.
- **User Benefit**: Indirectly, users benefit from a more optimized and frictionless experience as we identify and resolve pain points.
```

### 🔧 Standard Operating Procedure

1. **Always describe the core problem or opportunity from the end-user's/stakeholder's perspective.** What can they *not* do, what undesired experience are they having, or what new value could be created?
2. **Clearly articulate the impact (for bugs) or value (for features/enhancements)**: How many users/systems are affected? How often does it occur? What are the business consequences or benefits?
3. **Assign Severity (for bugs) and Priority (for all issues) labels thoughtfully**: Differentiate between how bad the issue is and how urgently it needs attention.
4. **Frame issues using user stories** to clarify the desired outcome and benefit.

## 3. Leveraging `gh` CLI for Issue Management

### ❌ What Didn't Work

**Problem**: Manually navigating to GitHub to create issues.

- Slows down workflow.
- Prone to forgetting details.

**Problem**: Not being aware of existing labels or milestones.

### ✅ What Worked

**Solution**: Using `gh` CLI for direct issue creation and management.

**Checking existing labels**:
```bash
gh label list
```
This command is invaluable for understanding the available labels before creating a new issue, ensuring consistency.

**Checking existing milestones**:
```bash
gh milestone list
```
Similarly, this helps in associating issues with relevant project phases.

**Creating a new issue interactively**:
```bash
gh issue create
```
This prompts for title, body, and allows adding labels, assignees, and milestones directly from the terminal.

**Creating a new issue with pre-filled content (from file):**
```bash
gh issue create --title "FEAT: Implement user activity feed" --body-file issue_template_feature.md --label feature,priority-P1,component-dashboard --assignee @your_github_handle
```
This is excellent for complex issues where the body is prepared in a separate file.

**Listing issues**:
```bash
gh issue list --state open --label bug --assignee @me
gh issue list --state open --label feature
```
This helps in quickly finding relevant issues.

### 🔧 Standard Operating Procedure

1. **Before creating a new issue, always run `gh label list` and `gh milestone list`** to familiarize yourself with existing options.
2. **For quick issues, use `gh issue create` interactively.**
3. **For detailed issues, prepare the issue body in a `.md` file** and use `gh issue create --body-file`. Consider having different templates (`issue_template_bug.md`, `issue_template_feature.md`).
4. **Always apply relevant labels and assignees** during creation.
5. **Use `gh issue list` regularly** to monitor your assigned tasks and overall project status.

## 4. Effective Codebase Search for Issue Context

### ❌ What Didn't Work

**Problem**: Relying solely on `grep -r` or IDE search without specific strategies.

- Too many irrelevant results.
- Missing context from surrounding files.

**Problem**: Not including relevant code snippets in the issue.

### ✅ What Worked

**Solution**: Targeted codebase search with a focus on context.

1. **Start with unique identifiers**:

   - **For Bugs**: Unique error messages, stack trace snippets, specific log messages, or function calls leading to the bug.
   ```bash
   grep -r "SpecificErrorString" .
   git grep "SpecificErrorString" # Faster and respects .gitignore
   ```

   - **For Features/Enhancements**: Existing related function names, API endpoints, module names, or configuration keys that will be affected or extended.
   ```bash
   grep -r "existing_dashboard_component" .
   git grep "existing_auth_api"
   ```

2. **Explore surrounding code**: Once a relevant file is found, open it and examine the code immediately before and after the identified line. This helps understand the flow, dependencies, and potential integration points.

3. **Identify configuration files**: Issues (bugs or features) often involve configuration. Search for common config file names or relevant environment variable names.
   ```bash
   grep -r "CONFIG_KEY_NAME" .
   ```

4. **Look for related tests**: Tests can provide insight into existing behavior, expected outcomes, and how certain components are intended to be used.
   ```bash
   grep -r "test_problematic_feature" . # For bugs
   grep -r "test_user_profile_data" .   # For features related to user profiles
   ```

5. **Include relevant code snippets in the issue**: Don't just link to files; copy and paste the few lines of code that are directly related to the issue, using proper Markdown code blocks. This makes the issue self-contained and easier to review.

### 🔧 Standard Operating Procedure

1. **Always start codebase search with the most unique identifier** (e.g., specific error message, function name, API endpoint).
2. **Use `git grep` for efficiency** within version-controlled repositories.
3. **Don't stop at the first match**: Explore the surrounding code and related files to understand the broader context.
4. **Include concise, relevant code snippets** in the GitHub issue using Markdown code blocks.
5. **Note the exact file path and line numbers** in the issue for easy navigation.

## 5. Git Commands for Issue Context and Reproduction

### ❌ What Didn't Work

**Problem**: Reporting issues without knowing the exact commit or branch.

- Difficulty in reproducing the issue on the correct version.

**Problem**: Not providing enough `git` context (e.g., `git blame` for recent changes related to a bug, or the history of a module for a feature).

### ✅ What Worked

**Solution**: Using `git` commands to pinpoint the exact context of an issue.

1. **Identify the current branch and commit**:
   ```bash
   git branch --show-current
   git rev-parse HEAD
   ```
   Include these in the issue's "Environment" section (especially for bugs) or as context for where a feature might be built from.

2. **Find recent changes to relevant files (`git log`)**:
   ```bash
   git log -p path/to/relevant/file.py
   ```
   This helps identify recent commits that might have introduced a bug or show the evolution of a module for feature development. Include the commit hash and author in the issue if relevant.

3. **Identify who last modified a line (`git blame`)**:
   ```bash
   git blame path/to/relevant/file.py -L 100,110
   ```
   This is invaluable for understanding the history of a specific section of code and potentially identifying the original author for consultation on either bugs or features.

4. **Show local uncommitted changes (`git diff`)**:
   If the issue (bug or observation for a feature) is observed in a local development environment with uncommitted changes, include the `git diff` output.
   ```bash
   git diff path/to/file.py
   ```

5. **Reverting for reproduction (`git checkout` / `git reset`)**:
   Sometimes, to confirm an issue or find a regression, or to understand how a feature worked previously, you might need to temporarily revert to an older commit.
   ```bash
   git checkout <commit_hash>

   # Test/observe and confirm issue or past behavior

   git checkout -
   ```
   (Be careful with `git reset` in shared branches).

### 🔧 Standard Operating Procedure

1. **Always include the branch name and full commit hash** in the issue details, especially for bugs. For features, noting the base branch (e.g., `main`) is often sufficient.
2. **If a specific file or module is involved, use `git log -p <file>`** to check its recent history, particularly for bugs or to understand existing implementations for features.
3. **Consider `git blame` for specific lines** to provide context on recent changes or original authors.
4. **Only include `git diff` output** if the issue is directly related to your local uncommitted changes.
5. **Use `git checkout <commit_hash>` for local reproduction** of historical issues or exploring past implementations, but remember to switch back to your development branch.

## 6. Managing Labels and Milestones

### ❌ What Didn't Work

**Problem**: Creating redundant labels or using inconsistent naming.

- `bug`, `Bug`, `critical bug` all existing.
- `new-feature`, `feature-request`, `feature-X` for the same concept.

**Problem**: Not assigning issues to milestones.

- Difficult to track project progress.

### ✅ What Worked

**Solution**: Proactive label and milestone management.

1. **Review existing labels/milestones first**: As mentioned, `gh label list` and `gh milestone list` are essential.
2. **Adhere to project-specific label conventions**: If Google projects have a standard set of labels (e.g., `type: bug`, `type: feature`, `priority: p1`, `component: auth`), always use them.
3. **Propose new labels only when truly necessary**: If a needed label is missing, propose it following the project's contribution guidelines (e.g., create a separate issue for label creation, or discuss with team leads).
4. **Use labels for categorizing issue type, priority, component, and status**:

   - `type: bug`, `type: feature`, `type: enhancement`, `type: question`, `type: chore`
   - `priority: p0`, `priority: p1`, `priority: p2` (or `P0-Crit`, `P1-High`, etc.)
   - `component: frontend`, `component: backend`, `component: database`, `component: ui`, `component: api`
   - `status: needs-triage`, `status: in-progress`, `status: blocked`, `status: completed`
5. **Assign issues to relevant milestones**: If the issue is part of a planned release or iteration, assign it to the corresponding milestone.
6. **Understand label hierarchy and color conventions**: Many projects use colors to signify label types (e.g., red for bugs, blue for features).

### 🔧 Standard Operating Procedure

1. **Before creating an issue, list all available labels and milestones** using `gh label list` and `gh milestone list`.
2. **Select the most appropriate labels and milestone** for the new issue.
3. **If a suitable label or milestone doesn't exist, discuss with the team** before creating new ones. Avoid ad-hoc label creation.
4. **Be consistent** in applying labels across all issues.
5. **Regularly review and clean up labels** if you have the necessary permissions.

## 7. Standard Operating Procedures

### Issue Creation Workflow

1. **Understand the problem/opportunity thoroughly**: For bugs, recreate it multiple times. For features, clarify the need and desired outcome.
2. **Check for existing issues**: Search GitHub to avoid duplicates or to find related discussions.
3. **Gather context**:

   - `gh label list` and `gh milestone list` to know existing options.
   - `git branch --show-current` and `git rev-parse HEAD` for current commit info (especially for bugs).
   - `grep` or `git grep` the codebase for relevant code snippets, error messages (for bugs), or existing code to be modified (for features).
   - `git log` or `git blame` for recent changes if applicable.
4. **Draft the issue content**: Use the structured template, adapting it to the issue type. Include:

   - Clear, concise title.
   - Problem statement (for bugs) or problem/opportunity (for features).
   - Exact steps to reproduce (for bugs).
   - Expected vs. Actual behavior (for bugs).
   - Proposed solution/requirements, user stories, acceptance criteria (for features).
   - Environment details (OS, browser, app versions, git commit).
   - Relevant code snippets and logs in Markdown code blocks.
   - Screenshots/recordings (for bugs) or mocks/wireframes (for features).
5. **Create the issue**: Use `gh issue create` (interactively or with `--body-file`).
6. **Apply labels, assignees, and milestones**.
7. **Proofread and submit**.

### Debugging and Issue Reporting Workflow (Primarily for Bugs)

1. **Identify the problem**: Observe the behavior and its impact on the end-user.
2. **Reproduce the problem**: Follow specific steps to consistently trigger it.
3. **Isolate the issue**: Narrow down the scope (e.g., specific component, environment, user action).
4. **Collect data**: Error messages, logs, relevant `git` history.
5. **Search codebase**: Find relevant code using unique identifiers from logs/errors.
6. **Formulate the issue**: Use the bug-specific template, providing all collected context.
7. **Create the issue**: Using `gh` CLI.
8. **Communicate**: If necessary, ping relevant team members on the issue or through other communication channels.

### Code Quality Checklist (for Issue Context)

- [ ] Issue title is concise and descriptive.
- [ ] Steps to reproduce are clear and actionable (for bugs).
- [ ] Expected and actual behaviors are well-defined (for bugs).
- [ ] Problem/Opportunity and Proposed Solution are clear (for features/enhancements).
- [ ] User stories and acceptance criteria are defined (for features/enhancements).
- [ ] All relevant environment details are included (OS, browser, app versions, git commit).
- [ ] Error messages and logs are included in code blocks (for bugs).
- [ ] Relevant code snippets from the codebase are included (for all types).
- [ ] User impact/value (who, how often, business consequence/benefit) is clearly stated.
- [ ] Appropriate labels are applied (type, priority, component).
- [ ] Issue is assigned to a relevant milestone (if applicable).
- [ ] Issue is assigned to the correct person(s).

### Testing Strategy (for Issue Verification)

1. **Reproduce the issue locally**: Use the provided steps and environment details.
2. **Verify fixes**: Once a fix is implemented, test it against the original steps to ensure the issue is resolved.
3. **Regression testing**: Check if the fix introduces any new bugs in related functionality.
4. **Environment consistency**: Test on different environments if the issue is environment-dependent.

## Key Takeaways

1. **Structured issues are paramount**: Use templates and Markdown for clarity and readability, adapting to the issue type.
2. **`gh` CLI is your best friend**: Automate issue creation and management directly from the terminal.
3. **Know your labels and milestones**: Use `gh label list` and `gh milestone list` to maintain consistency.
4. **Be a detective with codebase search**: Use `grep`/`git grep` strategically and provide relevant code snippets.
5. **`git` commands provide crucial context**: Always include branch, commit, and potentially `git log`/`git blame` details.
6. **Proactive issue management saves time**: A well-formed issue drastically reduces debugging time for others and clarifies development effort.
7. **Logging and error handling are key**: Good logs make good bug reports.
8. **User impact/value is critical**: Always articulate how the issue affects end-users and the business/project goals.
9. **Communication is part of issue creation**: Ensure the right people are aware and assigned.

This document should be updated as new lessons are learned during continued interaction with GitHub issues for Google projects.