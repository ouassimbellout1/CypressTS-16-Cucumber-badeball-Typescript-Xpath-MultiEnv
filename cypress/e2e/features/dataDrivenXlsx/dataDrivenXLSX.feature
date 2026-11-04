Feature: Data Driven with OrangeHRM

    Background: Navigate to OrangeHRM
        Given   J'accède a l'url "orangehrm"

    Scenario: Valid login
        When    J'accède à la page login
        And     Je me connecte avec les identifiants valides :
            | username | password |
            | Admin    | admin123 |
        Then    Je vérifie que le dashboard OrangeHRM est affiché

    Scenario: Invalid login with Excel file
        When    J'accède à la page login
        And     J'utilise "XLSX" pour se connecter
        Then    Je vérifie que la page de login OrangeHRM est affichée

    Scenario: Invalid login with Json file
        When    J'accède à la page login
        And     J'utilise "Json" pour se connecter
        Then    Je vérifie que la page de login OrangeHRM est affichée

    Scenario: Invalid login with data table
        When    J'accède à la page login
        And     J'utilise "table" pour se connecter
            | username | password |
            | user1    | 123      |
            | user2    | 456      |
            | user3    | 789      |
            | user4    | 753      |
        Then    Je vérifie que la page de login OrangeHRM est affichée

    Scenario: Invalid login with Random data table
        When    J'accède à la page login
        And     J'utilise "table Random" pour se connecter
            | ligne | username | password |
            | 1     | user1    | 123      |
            | 2     | user2    | 456      |
            | 3     | user3    | 789      |
            | 4     | user4    | 753      |
        Then    Je vérifie que la page de login OrangeHRM est affichée

    Scenario Outline: Invalid login with data table
        When    J'accède à la page login
        And     J'utiliser table pour se connecter with "<username>" and "<password>"
        Then    Je vérifie que la page de login OrangeHRM est affichée

        Examples:
            | username | password |
            | user1    | 123      |
            | user2    | 456      |
            | user3    | 789      |
            | user4    | 753      |