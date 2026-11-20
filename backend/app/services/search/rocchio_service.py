import math
from typing import List, Optional


class RocchioReranker:
    """Rocchio relevance feedback reranker: q' = alpha*q + beta*mean(good) - gamma*mean(bad)"""

    def __init__(self, alpha: float = 1.0, beta: float = 0.75, gamma: float = 0.25):
        self.alpha = alpha
        self.beta = beta
        self.gamma = gamma

    def _mean_vector(self, vectors: List[List[float]], dim: int) -> List[float]:
        if not vectors:
            return [0.0] * dim
        n = len(vectors)
        return [sum(v[i] for v in vectors) / n for i in range(dim)]

    def _normalize(self, v: List[float]) -> List[float]:
        norm = math.sqrt(sum(x * x for x in v))
        if norm == 0.0:
            return v
        return [x / norm for x in v]

    def update_query_vector(
        self,
        query_vector: List[float],
        positive_vectors: List[List[float]],
        negative_vectors: List[List[float]],
    ) -> List[float]:
        dim = len(query_vector)
        mean_pos = self._mean_vector(positive_vectors, dim)
        mean_neg = self._mean_vector(negative_vectors, dim)

        updated = [
            (self.alpha * query_vector[i])
            + (self.beta * mean_pos[i] if positive_vectors else 0.0)
            - (self.gamma * mean_neg[i] if negative_vectors else 0.0)
            for i in range(dim)
        ]
        return self._normalize(updated)
