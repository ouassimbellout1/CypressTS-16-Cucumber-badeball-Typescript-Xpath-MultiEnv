Feature: Connexion sur ExpandTesting

    Background: Accéder à la page de connexion
        Given J'accède a l'url "expandtesting"

    Scenario: Connexion réussie
        Given La page de connexion ExpandTesting est affichée
        When Je me connecte avec les identifiants valides sur ExpandTesting
        Then Je suis redirigé vers la zone sécurisée ExpandTesting

    Scenario: Connexion refusée avec un nom d'utilisateur invalide
        Given La page de connexion ExpandTesting est affichée
        When Je me connecte avec "wrongUser" et "SuperSecretPassword!"
        Then Je vois le message d'erreur "Invalid username." sur ExpandTesting
        And Je reste sur la page de connexion ExpandTesting

    Scenario: Connexion refusée avec un mot de passe invalide
        Given La page de connexion ExpandTesting est affichée
        When Je me connecte avec "practice" et "WrongPassword"
        Then Je vois le message d'erreur "Invalid password." sur ExpandTesting
        And Je reste sur la page de connexion ExpandTesting
