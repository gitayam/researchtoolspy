-- Migration 082: Clean up test data from workspace "1"
-- "Test Person 3" is a test actor with generic description polluting the default workspace.

DELETE FROM actors WHERE name = 'Test Person 3' AND workspace_id = '1';
