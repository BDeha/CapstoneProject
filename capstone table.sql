USE privilege_walk;

INSERT INTO prompts (question, type) VALUES
('If your primary ethnic identity is ''American'', take one step forward.', 'advantage'),
('If your parents did not grow up in the United States, take one step back.', 'disadvantage'),
('If your parents were professionals (doctors, lawyers, teachers), take one step forward.', 'advantage'),
('If one of your parents was unemployed or laid off work, take one step back.', 'disadvantage'),
('If your parents owned the house where you grew up, take one step forward.', 'advantage'),
('If your family ever had to move because they could not afford the rent, take one step back.', 'disadvantage'),
('If you saw members of your race, ethnic group, gender, or sexual orientation portrayed on television in degrading or devalued roles, take one step back.', 'disadvantage'),
('If you studied the culture of your ancestors in elementary school, take one step forward.', 'advantage'),
('If you never went to summer camp as a child, take one step back.', 'disadvantage'),
('If you attended a private or parochial elementary or high school, take one step forward.', 'advantage'),
('If you went to elementary or high school in the US speaking a language other than English, take one step back.', 'disadvantage'),
('If your parents told you that you could be anything you wanted to be, take one step forward.', 'advantage'),
('If you were raised in a single-parent household, take one step back.', 'disadvantage'),
('If there were fewer than 50 books in your house when you were growing up, take one step back.', 'disadvantage'),
('If you were never taken to art galleries or theater performances by your parents, take one step back.', 'disadvantage'),
('If you were told by your parents that you were attractive, smart, and capable, take one step forward.', 'advantage'),
('If your parents encouraged or expected you to attend college, take one step forward.', 'advantage'),
('If you were ever discouraged from academics or jobs because of race, class, gender, ethnicity, or sexual orientation, take one step back.', 'disadvantage'),
('If you were ever offered a good job because of your association with a friend or family member, take one step forward.', 'advantage'),
('If you were ever denied employment or a promotion because of your race, ethnicity, gender, sexual orientation, age, or ability, take one step back.', 'disadvantage'),
('If you have ever inherited money or property, take one step forward.', 'advantage'),
('If you were paid less, or treated unfairly because of race, ethnicity, gender, sexual orientation, age, or ability, take one step back.', 'disadvantage'),
('If you have ever had to rely primarily on public transportation, take one step back.', 'disadvantage'),
('If you are generally able to avoid places that are dangerous, take one step forward.', 'advantage'),
('If you were ever uncomfortable about a joke related to your race, ethnicity, gender, sexual orientation, ability, or age, but felt unsafe to confront the situation, take one step back.', 'disadvantage'),
('If you have never been followed or watched closely while shopping because of your race, ethnicity, or gender, take one step forward.', 'advantage'),
('If you were ever afraid of personal violence because of your race, ethnicity, gender, or sexual orientation, take one step back.', 'disadvantage'),
('If you were ever stopped or questioned by the police or other public authority because of your race, ethnicity, gender, sexual orientation, or age, take one step back.', 'disadvantage'),
('If you were ever the victim of violence related to your race, ethnicity, gender, age, or sexual orientation, take one step back.', 'disadvantage');

SELECT * FROM prompts;
ALTER TABLE responses ADD UNIQUE (student_alias);
SELECT * FROM responses;
TRUNCATE TABLE responses;
SELECT COUNT(*) FROM prompts;
TRUNCATE TABLE prompts;