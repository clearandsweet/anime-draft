
export const COMPETITION_POOL = [
    // Classics & Sports
    "A battle royale in a dense forest",
    "A cooking competition judged by Gordon Ramsay",
    "A game of 3-on-3 basketball",
    "A high-stakes poker tournament",
    "A talent show",
    "A debate on the meaning of life",
    "A race across the world",
    "A survival challenge on a deserted island",
    "A dance-off",
    "A chess tournament",
    "A rap battle",
    "A fashion show",
    "A scavenger hunt",
    "A paintball match",
    "A dodgeball game",
    "A game of Monopoly (that ends in a fight)",
    "A game of Uno (that ends in a fight)",

    // Olympic Events
    "100m Sprint",
    "Synchronized Swimming Duet",
    "Gymnastics Floor Routine",
    "Archery Contest",
    "Beach Volleyball",
    "Figure Skating Pairs",
    "Weightlifting",
    "Fencing Match",

    // Scenarios & "Who Would..."
    "Who can build the best IKEA furniture without instructions",
    "Who can survive a zombie apocalypse the longest",
    "Who would win in a fight against 100 duck-sized horses",
    "Who makes the best roommate",
    "Who is the best at explaining complex topics to a 5-year-old",
    "Who would be the best sitcom cast",
    "Who can solve a murder mystery first",
    "Who would survive a horror movie",
    "Who would win a Nobel Peace Prize",
    "Who would be the best President",
    "Who would be the best kindergarten teacher",
    "Who would be the best stand-up comedian",
    "Who would be the best spy",
    "Who would be the best heist crew",
    "Who would be the best band",
    "Who would be the best D&D party",
    "Who would be the best spaceship crew",
    "Who would be the best superhero team",
    "Who would be the best villain organization",
    "Who would be the best reality TV stars",
    "Who would be the best cult leaders",
    "Who would be the best fast food workers",
    "Who would be the best used car salesmen",
    "Who would be the best tech startup founders",
    "Who would be the best ghostbusters",
    "Who would be the best pirate crew",
    "Who would be the best ninja squad",
    "Who would be the best magical girl squad",
    "Who would be the best mecha pilots",
    "Who would be the best idol group",
];

export function getRandomCompetitions(count: number): string[] {
    const shuffled = [...COMPETITION_POOL].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}
