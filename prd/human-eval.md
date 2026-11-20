# Human evaluation

The TypeScript package gives a program a blind grading page: a person compares
model outputs from two output sets, A and B, and decides each item. Every
decision is the person's; the library never scores an output or picks a side. It
runs in Node only and is kept apart from the generation entry that Expo apps
load.

The calling program owns everything around the page: its cases, making the
outputs, choosing which items to show, saving files, and counting results. The
library owns what makes a decision blind.

## Rounds

A **round** is a question, what the person decides on each item, and a list of
items in the order shown. The question is what the person answers on every item,
such as "Which reply is kinder?". A round asks one of two things:

- **Per item**: the person picks the side that answers the question better for
  the whole item, or a tie.
- **Per speaker**: for any speaker, the person may mark the side whose output is
  better; a speaker left unmarked is a tie.

An **item** holds the case as the person reads it and one or more speakers, each
with its output in set A and in set B, its gender, and a description of what it
is meant to sound like. A round with no items is refused, since nothing could
finish it.

The case text follows a line convention: a heading line, list lines, and
highlighted quote lines, with any other line a paragraph. A description is a
title over titled sections of named fields.

## Blind sides

Each item puts set A on the left or the right at random. The page only ever
learns Left and Right; which set is where stays with the program serving it.

## Choices

The page shows one item at a time. In a per-item round the person picks a side
or a tie and writes a reason; a pick of a side without a reason is refused and
nothing is recorded, while a tie may have none. In a per-speaker round each mark
needs a reason; a mark without one, on an unknown speaker, or twice on one
speaker is refused. An item already decided, or one that is not in the round, is
refused.

Choices are kept in memory. The page can be closed and opened again while the
round runs, and picks up at the first undecided item. If the process stops
before every item is decided, the round is lost.

## Verdicts

When the last item is decided, the round ends and returns the verdicts in item
order. A per-item round gives one per item: the set picked (A, B, or a tie) and
the reason as written, or none for a tie left without one. A per-speaker round
gives one per speaker of each item, in the item's order: the set marked better
and its reason, or a tie without one when unmarked.
