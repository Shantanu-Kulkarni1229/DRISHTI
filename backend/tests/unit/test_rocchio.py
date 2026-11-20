import math
from app.services.search.rocchio_service import RocchioReranker


def test_rocchio_positive_feedback_shifts_query():
    reranker = RocchioReranker(alpha=1.0, beta=0.8, gamma=0.4)
    q0 = [1.0, 0.0, 0.0]
    good = [[0.0, 1.0, 0.0]]  # User positively marked feature in second dimension
    bad = []

    q1 = reranker.update_query_vector(q0, positive_vectors=good, negative_vectors=bad)
    # The second dimension should now be significantly positive
    assert q1[1] > 0.4
    # Vector remains normalized (length approx 1.0)
    norm = math.sqrt(sum(x * x for x in q1))
    assert math.isclose(norm, 1.0, rel_tol=1e-5)


def test_rocchio_negative_feedback_suppresses_noise():
    reranker = RocchioReranker(alpha=1.0, beta=0.8, gamma=0.5)
    q0 = [0.5, 0.5, 0.0]
    good = []
    bad = [[0.0, 1.0, 0.0]]  # User disliked second dimension

    q1 = reranker.update_query_vector(q0, positive_vectors=good, negative_vectors=bad)
    assert q1[1] < q0[1]  # Second dimension is suppressed
