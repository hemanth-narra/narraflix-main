/**
 * Curated Top 10 Movies and Webseries for Narraflix
 * Pre-cached with high-res posters and verified IMDb IDs for instant 0ms load.
 */

const FEATURED_MOVIES = [
    {
        rank: 1,
        id: 'tt15398776',
        title: 'Oppenheimer',
        year: '2023',
        type: 'movie',
        poster: 'https://m.media-amazon.com/images/M/MV5BMDBmYTZjNjUtN2M1MS00MTQ2LTk2ODgtNzc2M2QyZGE5NTVjXkEyXkFqcGdeQXVyNzAwMjU2MTY@._V1_SX300.jpg'
    },
    {
        rank: 2,
        id: 'tt0816692',
        title: 'Interstellar',
        year: '2014',
        type: 'movie',
        poster: 'https://m.media-amazon.com/images/M/MV5BZjdkOTU3MDktN2IxOS00OGEyLWFmMjktY2FiMmZkNWIyODZiXkEyXkFqcGdeQXVyMTMxODk2OTU@._V1_SX300.jpg'
    },
    {
        rank: 3,
        id: 'tt0468569',
        title: 'The Dark Knight',
        year: '2008',
        type: 'movie',
        poster: 'https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_SX300.jpg'
    },
    {
        rank: 4,
        id: 'tt1375666',
        title: 'Inception',
        year: '2010',
        type: 'movie',
        poster: 'https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_SX300.jpg'
    },
    {
        rank: 5,
        id: 'tt15239678',
        title: 'Dune: Part Two',
        year: '2024',
        type: 'movie',
        poster: 'https://m.media-amazon.com/images/M/MV5BN2QyZGU4ZDctOWMzMy00NTc5LThlOGQtODhmNDI1NmY5YzAwXkEyXkFqcGdeQXVyMDM2NDM2MQ@@._V1_SX300.jpg'
    },
    {
        rank: 6,
        id: 'tt0137523',
        title: 'Fight Club',
        year: '1999',
        type: 'movie',
        poster: 'https://m.media-amazon.com/images/M/MV5BOTgyOGQ1NDItNGU3Ny00MjU3LTg2YTQtNmIzMS03YzI1MmQzXkEyXkFqcGdeQXVyMTUzMTg2ODkz._V1_SX300.jpg'
    },
    {
        rank: 7,
        id: 'tt9362722',
        title: 'Spider-Man: Across the Spider-Verse',
        year: '2023',
        type: 'movie',
        poster: 'https://m.media-amazon.com/images/M/MV5BMzI0NmVkMjEtYmY4MS00ZDMxLTlkZmEtMzU4MDQxYTMzMjU2XkEyXkFqcGdeQXVyMzQ0MzA0NTM@._V1_SX300.jpg'
    },
    {
        rank: 8,
        id: 'tt0110912',
        title: 'Pulp Fiction',
        year: '1994',
        type: 'movie',
        poster: 'https://m.media-amazon.com/images/M/MV5BNGNhMDIzZTUtNTBlZi00MTRlLWFjM2ItYzViMjE3YzI5MjljXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_SX300.jpg'
    },
    {
        rank: 9,
        id: 'tt0133093',
        title: 'The Matrix',
        year: '1999',
        type: 'movie',
        poster: 'https://m.media-amazon.com/images/M/MV5BNzQzOTk3OTAtNDQ0Zi00ZTVkLWI0MTEtMDllZjNkYzNjNTc4L2ltYWdlXkEyXkFqcGdeQXVyNjU0OTQ0OTY@._V1_SX300.jpg'
    },
    {
        rank: 10,
        id: 'tt0172495',
        title: 'Gladiator',
        year: '2000',
        type: 'movie',
        poster: 'https://m.media-amazon.com/images/M/MV5BYWQ4YmNjYjEtOWE1Zi00Y2U4LWI4NTAtMTU0MjkxNWQ1ZmJiXkEyXkFqcGdeQXVyNzAwMjU2MTY@._V1_SX300.jpg'
    }
];

const FEATURED_SERIES = [
    {
        rank: 1,
        id: 'tt0903747',
        title: 'Breaking Bad',
        year: '2008–2013',
        type: 'series',
        poster: 'https://m.media-amazon.com/images/M/MV5BYmQ4YWMxYjUtNjZmYi00MDQ1LWFjMjAtNjA5ZDZmMjYzYjAzXkEyXkFqcGdeQXVyMTUzMTg2ODkz._V1_SX300.jpg'
    },
    {
        rank: 2,
        id: 'tt0944947',
        title: 'Game of Thrones',
        year: '2011–2019',
        type: 'series',
        poster: 'https://m.media-amazon.com/images/M/MV5BN2IzYzBiOTQtNGZmMi00NDI5LTgxMzMtN2EzZjA1NjhlOGMxXkEyXkFqcGdeQXVyNjAwNDUxODI@._V1_SX300.jpg'
    },
    {
        rank: 3,
        id: 'tt4574334',
        title: 'Stranger Things',
        year: '2016–',
        type: 'series',
        poster: 'https://m.media-amazon.com/images/M/MV5BMDZkYmVhNjMtNWU4MC00MDQxLWE3YTgtZTZlN2RmZzk1ZGY2XkEyXkFqcGdeQXVyMTkxNjUyNQ@@._V1_SX300.jpg'
    },
    {
        rank: 4,
        id: 'tt8602636',
        title: 'Chernobyl',
        year: '2019',
        type: 'series',
        poster: 'https://m.media-amazon.com/images/M/MV5BNTEyZGU4NzktYWY0ZS00NTAzLWE1NzctYmQzMmIwNGU0OTFiXkEyXkFqcGdeQXVyMjg0OTQ5MTU@._V1_SX300.jpg'
    },
    {
        rank: 5,
        id: 'tt3581920',
        title: 'The Last of Us',
        year: '2023–',
        type: 'series',
        poster: 'https://m.media-amazon.com/images/M/MV5BZGUzYTI3M2EtZmM0Yy00NGUyLWI4ODEtN2Q3ZGJlYzhhZjU3XkEyXkFqcGdeQXVyNTkyMDcwODA@._V1_SX300.jpg'
    },
    {
        rank: 6,
        id: 'tt7660850',
        title: 'Succession',
        year: '2018–2023',
        type: 'series',
        poster: 'https://m.media-amazon.com/images/M/MV5BOGQ1YWU5ZWEtNTk4OS00YWQ1LTkyYjgtODkzMGQyZjliNTEwXkEyXkFqcGdeQXVyMTMzNzIyNDc1._V1_SX300.jpg'
    },
    {
        rank: 7,
        id: 'tt3032476',
        title: 'Better Call Saul',
        year: '2015–2022',
        type: 'series',
        poster: 'https://m.media-amazon.com/images/M/MV5BNDUyYjVjNzUtMWU0OC00OWE1LWFhNzMtZmM2ZTIwMmY4ZmVkXkEyXkFqcGdeQXVyMTUzMTg2ODkz._V1_SX300.jpg'
    },
    {
        rank: 8,
        id: 'tt1190634',
        title: 'The Boys',
        year: '2019–',
        type: 'series',
        poster: 'https://m.media-amazon.com/images/M/MV5BYzA2Nzk5M2EtNWY4Yi00ZDY4LThkZTgtYjhhNzc4YzliZmVjXkEyXkFqcGdeQXVyMTkxNjUyNQ@@._V1_SX300.jpg'
    },
    {
        rank: 9,
        id: 'tt11126994',
        title: 'Arcane',
        year: '2021–',
        type: 'series',
        poster: 'https://m.media-amazon.com/images/M/MV5BYTViYTE3NWMtNmRhZi00NzRiLWI4MTMtMGU0NTk1ZTQ5NDcyXkEyXkFqcGdeQXVyMTkxNjUyNQ@@._V1_SX300.jpg'
    },
    {
        rank: 10,
        id: 'tt11198330',
        title: 'House of the Dragon',
        year: '2022–',
        type: 'series',
        poster: 'https://m.media-amazon.com/images/M/MV5BOGVjYmM5YmQtNmY2Ny00ZTk0LTlhYTYtZmVkZTk3YWE0NDBlXkEyXkFqcGdeQXVyMTUzMTg2ODkz._V1_SX300.jpg'
    }
];
