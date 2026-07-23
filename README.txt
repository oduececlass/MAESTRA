EE Assessment Suite v7.1.0 — Dual Assessment Player Editions

Recommended distribution
------------------------
- Give students: apps/assessment_player_student.html
- Keep for instructors: apps/assessment_player_teacher.html
- apps/assessment_player.html is an alias of the Student Edition.

Student Edition restrictions
----------------------------
- Blocks Ctrl/Cmd+V and Shift+Insert inside EE Canvas.
- Blocks browser paste events and beforeinput paste/drop insertion.
- Hides and disables the EE Canvas Paste button.
- Blocks external text, HTML, URI, and file drag/drop into EE Canvas.
- Does not block normal drawing, equations, typed quiz fields, canvas saving,
  or file-import controls deliberately provided by an assignment.
- Records only blocked-attempt type, question ID, and timestamp. Clipboard
  contents are never read or stored.

Teacher Edition
---------------
- Retains full EE Canvas clipboard and drag/drop functionality.
- Intended for quiz testing, solution preparation, and demonstrations.

Security note
-------------
These are self-contained browser applications. Student Edition restrictions
are useful deterrents but cannot replace a managed browser, secure testing
center, or proctoring system for high-stakes exams.
